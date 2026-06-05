// Wake-word listener.
//
// Subscribes to the device microphone (via expo-av) and feeds PCM frames
// into a small openWakeWord-style keyword-spotting routine. When the
// "Hey omni" keyword is detected, a `wake` event is emitted.
//
// We use a deliberately permissive contract so this module works in three
// environments:
//   1. RN with expo-av + openWakeWord RN native module (real device)
//   2. RN with expo-av but no native module (mic + heuristic energy gate)
//   3. Tests + headless environments (programmatic `emit()` injection)
//
// The keyword model is exposed as a separate `WakeDetector` interface so
// the listener can swap between `native`, `energy`, and `mock` backends.

export type WakeEvent = {
	keyword: string
	confidence: number
	ts: number
}

type Listener<T> = (value: T) => void

export type WakeDetectorBackend = 'native' | 'energy' | 'mock'

export type WakeDetector = {
	readonly backend: WakeDetectorBackend
	readonly keyword: string
	reset(): void
	pushFrame(samples: Float32Array, sampleRate: number): WakeEvent | null
	destroy?(): void
}

// Energy-based fallback detector. We treat sustained loudness above a
// threshold as a "wake" — useful on dev devices where openWakeWord's
// RN module isn't linked. It is *not* a real keyword spotter; production
// wake should use the native path.
export class EnergyWakeDetector implements WakeDetector {
	readonly backend: WakeDetectorBackend = 'energy'
	constructor(public readonly keyword: string) {}

	private threshold = 0.18
	private holdFrames = 0
	private holdRequired = 6
	private cooldownUntil = 0
	private cooldownMs = 1500

	reset(): void {
		this.holdFrames = 0
	}

	pushFrame(samples: Float32Array, _sampleRate: number): WakeEvent | null {
		if (samples.length === 0) return null
		const now = Date.now()
		if (now < this.cooldownUntil) return null

		let sumSq = 0
		for (let i = 0; i < samples.length; i++) {
			const v = samples[i] ?? 0
			sumSq += v * v
		}
		const rms = Math.sqrt(sumSq / samples.length)
		if (rms >= this.threshold) this.holdFrames++
		else this.holdFrames = 0

		if (this.holdFrames >= this.holdRequired) {
			this.holdFrames = 0
			this.cooldownUntil = now + this.cooldownMs
			return {
				keyword: this.keyword,
				confidence: Math.min(1, rms / 0.5),
				ts: now,
			}
		}
		return null
	}
}

// Mock detector. The WakeListener is the source of truth for emissions;
// the mock just allows tests to push frames without expecting a wake.
export class MockWakeDetector implements WakeDetector {
	readonly backend: WakeDetectorBackend = 'mock'
	constructor(public readonly keyword: string) {}
	reset(): void {}
	pushFrame(_samples: Float32Array, _sampleRate: number): WakeEvent | null {
		return null
	}
}

export type WakeListenerOptions = {
	keyword?: string
	detector?: WakeDetector
	// sampleRate we expect the mic to deliver. Most ASR stacks use 16kHz.
	sampleRate?: number
	// Window of mic frames to buffer before running the detector; smaller =
	// lower latency but more CPU.
	frameMs?: number
}

export type WakeListenerState =
	| 'idle'
	| 'starting'
	| 'listening'
	| 'stopping'
	| 'error'

export class WakeListener {
	private listeners = new Map<string, Set<Listener<unknown>>>()
	private detector: WakeDetector
	private keyword: string
	private sampleRate: number
	private frameMs: number
	private state: WakeListenerState = 'idle'
	private recording: Recording | null = null
	private startPromise: Promise<void> | null = null

	constructor(options: WakeListenerOptions = {}) {
		this.keyword = options.keyword ?? 'omni'
		this.sampleRate = options.sampleRate ?? 16000
		this.frameMs = options.frameMs ?? 100
		this.detector = options.detector ?? new EnergyWakeDetector(this.keyword)
	}

	getState(): WakeListenerState {
		return this.state
	}

	getDetectorBackend(): WakeDetectorBackend {
		return this.detector.backend
	}

	getKeyword(): string {
		return this.keyword
	}

	on(event: 'wake' | 'error' | 'state', fn: Listener<unknown>): () => void {
		let set = this.listeners.get(event)
		if (!set) {
			set = new Set()
			this.listeners.set(event, set)
		}
		set.add(fn as Listener<unknown>)
		return () => set?.delete(fn as Listener<unknown>)
	}

	private emit(event: string, value: unknown): void {
		const set = this.listeners.get(event)
		if (!set) return
		for (const fn of set) {
			try {
				;(fn as Listener<unknown>)(value)
			} catch {
				// listener errors should not break the emitter
			}
		}
	}

	async start(): Promise<void> {
		if (this.state === 'listening' || this.state === 'starting') return
		if (this.startPromise) return this.startPromise
		this.setState('starting')
		this.startPromise = (async () => {
			try {
				const rec = await openRecording({
					sampleRate: this.sampleRate,
					frameMs: this.frameMs,
					onFrame: (samples, sr) => this.handleFrame(samples, sr),
					onError: (err) => {
						this.emit('error', err)
						this.setState('error')
					},
				})
				this.recording = rec
				this.detector.reset()
				this.setState('listening')
			} catch (err) {
				this.emit('error', err as Error)
				this.setState('error')
				throw err
			} finally {
				this.startPromise = null
			}
		})()
		return this.startPromise
	}

	stop(): void {
		if (this.state === 'idle' || this.state === 'stopping') return
		this.setState('stopping')
		try {
			this.recording?.stop()
		} catch {
			// ignore
		}
		this.recording = null
		this.detector.reset()
		this.setState('idle')
	}

	// Test/programmatic entry point — feeds raw PCM frames and runs the
	// detector synchronously. Returns the emitted event (if any).
	handleFrame(samples: Float32Array, sampleRate: number): WakeEvent | null {
		const ev = this.detector.pushFrame(samples, sampleRate)
		if (ev) this.emit('wake', ev)
		return ev
	}

	private setState(next: WakeListenerState): void {
		if (this.state === next) return
		this.state = next
		this.emit('state', next)
	}
}

// The mic-recording layer is kept as a tiny interface so tests can stub it.
// The real implementation lazily imports `expo-av` and `expo-permissions`
// and is injected via `setRecordingFactory`. Defaults to a no-op recorder
// that throws — callers should always set a real factory before .start().

export type Recording = {
	stop(): void
}

export type RecordingOptions = {
	sampleRate: number
	frameMs: number
	onFrame: (samples: Float32Array, sampleRate: number) => void
	onError: (err: Error) => void
}

let recordingFactory: ((opts: RecordingOptions) => Promise<Recording>) | null =
	null

export function setRecordingFactory(
	factory: (opts: RecordingOptions) => Promise<Recording>,
): void {
	recordingFactory = factory
}

// Test-only: clear the global factory so a subsequent start() rejects.
// Not exported on the public surface in production; mainly used to
// keep the listener unit tests deterministic.
export function unsetRecordingFactory(): void {
	recordingFactory = null
}

// Internal accessor for sibling modules (capture.ts) that need to reuse
// the same factory. Not part of the public API.
export const _recordingFactory = (
	opts: RecordingOptions,
): Promise<Recording> => {
	if (!recordingFactory) {
		throw new Error(
			'No recording factory registered. Call setRecordingFactory() before start().',
		)
	}
	return recordingFactory(opts)
}

async function openRecording(opts: RecordingOptions): Promise<Recording> {
	return _recordingFactory(opts)
}

export const wake = new WakeListener()
