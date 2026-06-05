// Unit tests for the VoicePipeline. We stub the WakeListener and
// MeshInference so we can drive the state machine deterministically.

import { beforeEach, describe, expect, it } from 'bun:test'
import type { MeshInference } from '../mesh/inference.ts'
import { setCaptureFactory } from './capture.ts'
import type { WakeListener } from './listener.ts'
import { VoicePipeline, type VoiceState } from './pipeline.ts'

type WakeEvent = { keyword: string; confidence: number; ts: number }

class FakeWakeListener {
	private wakeListeners: ((ev: WakeEvent) => void)[] = []
	private stateListeners: ((s: string) => void)[] = []
	private state = 'idle'
	private keyword: string

	constructor(keyword = 'omni') {
		this.keyword = keyword
	}

	getKeyword(): string {
		return this.keyword
	}

	getState(): string {
		return this.state
	}

	getDetectorBackend(): 'mock' {
		return 'mock'
	}

	on(event: string, fn: (v: unknown) => void): () => void {
		if (event === 'wake') {
			this.wakeListeners.push(fn as (ev: WakeEvent) => void)
			return () => {
				this.wakeListeners = this.wakeListeners.filter((l) => l !== fn)
			}
		}
		if (event === 'state') {
			this.stateListeners.push(fn as (s: string) => void)
			return () => {
				this.stateListeners = this.stateListeners.filter((l) => l !== fn)
			}
		}
		return () => {
			// unsupported event — no-op
		}
	}

	fireWake(ev: WakeEvent): void {
		this.state = 'listening'
		for (const fn of this.stateListeners) fn('listening')
		for (const fn of this.wakeListeners) fn(ev)
	}
}

class FakeInference {
	transcript = 'hello world'
	reply = 'hi there'
	audioSamples: number[] = [1, 2, 3]
	played: { samples: Int16Array; sampleRate: number } | null = null
	playAudio = async (samples: Int16Array, sampleRate: number) => {
		this.played = { samples, sampleRate }
	}

	// The pipeline calls inference.infer() for ASR, LLM, and TTS. We
	// dispatch on the modelId to return the appropriate fixture.
	async infer(
		req: { modelId: string; input: unknown; stream?: boolean },
		onEvent: (ev: { type: string; [k: string]: unknown }) => void,
	): Promise<void> {
		if (req.modelId.includes('whisper')) {
			onEvent({ type: 'done', result: { text: this.transcript } })
		} else if (req.modelId.includes('tts') || req.modelId.includes('kokoro')) {
			onEvent({
				type: 'delta',
				delta: { samples: this.audioSamples, sampleRate: 22050 },
			})
			onEvent({
				type: 'done',
				result: { samples: this.audioSamples, sampleRate: 22050 },
			})
		} else {
			onEvent({ type: 'delta', delta: { text: this.reply } })
			onEvent({ type: 'done', result: { text: this.reply } })
		}
	}
}

describe('VoicePipeline', () => {
	let wake: FakeWakeListener
	let inf: FakeInference
	let pipe: VoicePipeline
	let states: VoiceState[]
	let turns: { role: 'user' | 'assistant'; text: string; ts: number }[]
	let errors: Error[]

	beforeEach(() => {
		wake = new FakeWakeListener()
		inf = new FakeInference()
		states = []
		turns = []
		errors = []
		// Register a deterministic capture factory so the pipeline's
		// `captureUtterance` step returns immediately with one loud frame.
		setCaptureFactory(async (opts) => {
			opts.onFrame(new Float32Array(1600).fill(0.5), 16000)
			return {
				stop() {
					// noop
				},
			}
		})
		pipe = new VoicePipeline(
			{
				listener: wake as unknown as WakeListener,
				inference: inf as unknown as MeshInference,
				playAudio: inf.playAudio,
				maxRecordMs: 10,
			},
			{
				onState: (s) => states.push(s),
				onTurn: (t) => turns.push(t),
				onError: (e) => errors.push(e),
			},
		)
	})

	it('drives idle → recording → transcribing → inferring → speaking → idle', async () => {
		pipe.attach()
		wake.fireWake({ keyword: 'omni', confidence: 0.9, ts: Date.now() })
		await waitFor(() => states.includes('speaking'))
		// Allow the final setState('idle') to flush.
		await new Promise((r) => setTimeout(r, 20))
		expect(states).toEqual([
			'recording',
			'transcribing',
			'inferring',
			'speaking',
			'idle',
		])
	})

	it('records one user + one assistant turn', async () => {
		pipe.attach()
		wake.fireWake({ keyword: 'omni', confidence: 0.9, ts: Date.now() })
		await waitFor(() => turns.length >= 3) // [wake], transcript, reply
		const userTurns = turns.filter((t) => t.role === 'user')
		const assistantTurns = turns.filter((t) => t.role === 'assistant')
		// Skip the synthetic [wake] turn.
		const transcriptTurn = userTurns.find((t) => t.text !== '[wake]')
		expect(transcriptTurn?.text).toBe('hello world')
		expect(assistantTurns[0]?.text).toBe('hi there')
	})

	it('plays the TTS audio after the assistant speaks', async () => {
		pipe.attach()
		wake.fireWake({ keyword: 'omni', confidence: 0.9, ts: Date.now() })
		await waitFor(() => inf.played !== null)
		expect(inf.played).not.toBeNull()
		expect(inf.played?.sampleRate).toBe(22050)
		expect(inf.played?.samples.length).toBe(3)
	})

	it('is a no-op when a second wake fires while busy', async () => {
		pipe.attach()
		wake.fireWake({ keyword: 'omni', confidence: 0.9, ts: Date.now() })
		wake.fireWake({ keyword: 'omni', confidence: 0.9, ts: Date.now() })
		await waitFor(() => states.includes('speaking'))
		// Only one round of phases should have run.
		const recordingCount = states.filter((s) => s === 'recording').length
		expect(recordingCount).toBe(1)
	})

	it('detach() removes the wake subscription', async () => {
		pipe.attach()
		pipe.detach()
		wake.fireWake({ keyword: 'omni', confidence: 0.9, ts: Date.now() })
		await new Promise((r) => setTimeout(r, 20))
		expect(states).toEqual([])
		expect(turns).toEqual([])
	})

	it('clearHistory resets the conversation context', () => {
		pipe.clearHistory()
		expect(pipe.getHistory()).toEqual([])
	})

	it('recovers gracefully when inference throws', async () => {
		// Inference errors are swallowed per-stage and the pipeline returns
		// to idle. The state machine should not get stuck.
		inf.infer = async (_req, _onEvent) => {
			throw new Error('boom')
		}
		pipe.attach()
		wake.fireWake({ keyword: 'omni', confidence: 0.9, ts: Date.now() })
		await waitFor(() => states.includes('idle'))
		expect(states).toContain('idle')
	})
})

async function waitFor(cond: () => boolean, timeoutMs = 1000): Promise<void> {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		if (cond()) return
		await new Promise((r) => setTimeout(r, 10))
	}
}
