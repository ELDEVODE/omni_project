// openWakeWord bridge.
//
// Production wake-word detection runs the openWakeWord Rust model on the
// device. React Native does not bundle a built-in binding for the Rust
// crate, so we expose a thin wrapper around a native module that the
// Expo dev client (or a config plugin) can install later.
//
// The module contract:
//   1. `OWW.init({ keyword: 'omni', threshold?: number })`
//   2. `OWW.pushSamples(Float32Array, sampleRate)` → returns `{ score, detected }`
//   3. `OWW.close()` releases the model from memory.
//
// When the native module is not linked, `OWW.isAvailable()` returns false
// and the WakeListener falls back to the energy detector.

export type OWWResult = {
	score: number
	detected: boolean
}

export type OWWOptions = {
	keyword?: string
	threshold?: number
}

export type OWW = {
	isAvailable(): boolean
	init(opts: OWWOptions): Promise<void>
	pushSamples(samples: Float32Array, sampleRate: number): Promise<OWWResult>
	close(): Promise<void>
}

class LazyOWW implements OWW {
	private native: unknown | null
	private initialized = false

	constructor() {
		this.native = null
	}

	isAvailable(): boolean {
		return this.native !== null
	}

	async init(opts: OWWOptions): Promise<void> {
		if (this.initialized) return
		try {
			const mod = (await import('react-native').catch(() => null)) as {
				NativeModules?: Record<string, unknown>
			} | null
			const native = mod?.NativeModules?.OmniWakeWord ?? null
			if (!native) {
				throw new Error('OmniWakeWord native module is not linked')
			}
			await (native as { init: (o: OWWOptions) => Promise<void> }).init(opts)
			this.native = native
			this.initialized = true
		} catch (err) {
			this.native = null
			this.initialized = false
			throw new Error(`OWW init failed: ${(err as Error).message}`)
		}
	}

	async pushSamples(
		samples: Float32Array,
		sampleRate: number,
	): Promise<OWWResult> {
		if (!this.initialized || !this.native) {
			return { score: 0, detected: false }
		}
		const result = await (
			this.native as {
				pushSamples: (s: Float32Array, sr: number) => Promise<OWWResult>
			}
		).pushSamples(samples, sampleRate)
		return result
	}

	async close(): Promise<void> {
		if (!this.initialized || !this.native) return
		try {
			await (this.native as { close: () => Promise<void> }).close()
		} finally {
			this.native = null
			this.initialized = false
		}
	}
}

export const oww: OWW = new LazyOWW()

// Helper: a WakeDetector backed by openWakeWord. Callers should register
// this with the WakeListener to upgrade the energy fallback once the
// native module becomes available.
import type { WakeDetector, WakeEvent } from './listener.ts'

export class OpenWakeWordDetector implements WakeDetector {
	readonly backend = 'native' as const
	constructor(public readonly keyword: string) {}
	reset(): void {}
	pushFrame(samples: Float32Array, sampleRate: number): WakeEvent | null {
		// openWakeWord is async; the WakeListener's frame loop is sync.
		// This detector must be wired through a custom pipeline that
		// awaits the result — see the README for the integration pattern.
		void samples
		void sampleRate
		return null
	}
}
