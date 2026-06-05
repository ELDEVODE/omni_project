// VoicePipeline — the high-level "Hey omni" loop.
//
// State machine:
//   idle     → on wake → recording
//   recording → on VAD end / timeout → transcribing
//   transcribing → on text → inferring
//   inferring → on first token → speaking
//   speaking → on playback end → idle
//
// All steps except wake detection and (optionally) local ASR/TTS go
// through `MeshInference`, which posts to the host's HTTP API. This means
// the phone can run the whole voice loop *without* a local QVAC SDK —
// it just streams PCM/JSON over HTTPS to the host and a worker handles
// whisper, llama, and supertonic.

import type { MeshInference } from '../mesh/inference.ts'
import type { QVACConsumer } from '../qvac/consumer.ts'
import type { WakeEvent, WakeListener } from './listener.ts'

export type VoiceState =
	| 'idle'
	| 'recording'
	| 'transcribing'
	| 'inferring'
	| 'speaking'
	| 'error'

export type VoiceTurn = {
	role: 'user' | 'assistant'
	text: string
	ts: number
}

export type VoicePipelineOptions = {
	listener: WakeListener
	inference: MeshInference
	// Optional QVAC consumer. When present, the LLM step delegates
	// directly to the worker's QVAC provider (peer.providerPublicKey)
	// via loadModel({ delegate }) + completion(). When absent, the
	// pipeline falls back to the host HTTP /api/infer path.
	qvac?: {
		consumer: QVACConsumer
		providerPublicKey: string
	}
	// Default model IDs used when the active models are not yet known.
	asrModelId?: string
	llmModelId?: string
	ttsModelId?: string
	// VAD / recording tuning
	maxRecordMs?: number
	silenceStop?: boolean
	// Optional audio playback hook. If absent the pipeline emits the
	// synthesized PCM buffer via the `tts` event and the UI is free to
	// play it via expo-av.
	playAudio?: (samples: Int16Array, sampleRate: number) => Promise<void>
}

export type VoicePipelineEvents = {
	onState?: (state: VoiceState) => void
	onTurn?: (turn: VoiceTurn) => void
	onError?: (err: Error) => void
}

export class VoicePipeline {
	private opts: VoicePipelineOptions
	private events: VoicePipelineEvents
	private state: VoiceState = 'idle'
	private history: {
		role: 'system' | 'user' | 'assistant'
		content: string
	}[] = []
	private unwake: (() => void) | null = null
	private stateAbort: AbortController | null = null

	constructor(opts: VoicePipelineOptions, events: VoicePipelineEvents = {}) {
		this.opts = opts
		this.events = events
	}

	getState(): VoiceState {
		return this.state
	}

	getHistory(): { role: 'system' | 'user' | 'assistant'; content: string }[] {
		return [...this.history]
	}

	clearHistory(): void {
		this.history = []
	}

	attach(): void {
		if (this.unwake) return
		const fn = (ev: unknown) => this.onWake(ev as WakeEvent)
		this.unwake = this.opts.listener.on('wake', fn)
	}

	detach(): void {
		this.unwake?.()
		this.unwake = null
		this.cancel()
	}

	private setState(next: VoiceState): void {
		if (this.state === next) return
		this.state = next
		this.events.onState?.(next)
	}

	private cancel(): void {
		this.stateAbort?.abort()
		this.stateAbort = null
	}

	private async onWake(ev: WakeEvent): Promise<void> {
		if (this.state !== 'idle') return
		this.cancel()
		this.stateAbort = new AbortController()
		this.setState('recording')
		this.events.onTurn?.({ role: 'user', text: '[wake]', ts: ev.ts })

		try {
			const audio = await this.captureUtterance(this.stateAbort.signal)
			if (!audio || audio.samples.length === 0) {
				this.setState('idle')
				return
			}

			this.setState('transcribing')
			const transcript = await this.transcribe(audio, this.stateAbort.signal)
			if (!transcript) {
				this.setState('idle')
				return
			}
			this.events.onTurn?.({ role: 'user', text: transcript, ts: Date.now() })

			this.setState('inferring')
			this.history.push({ role: 'user', content: transcript })
			const reply = await this.infer(this.stateAbort.signal)
			if (!reply) {
				this.setState('idle')
				return
			}
			this.history.push({ role: 'assistant', content: reply })
			this.events.onTurn?.({ role: 'assistant', text: reply, ts: Date.now() })

			this.setState('speaking')
			await this.speak(reply, this.stateAbort.signal)
			this.setState('idle')
		} catch (err) {
			if ((err as Error).name === 'AbortError') {
				this.setState('idle')
				return
			}
			this.events.onError?.(err as Error)
			this.setState('error')
		}
	}

	// Capture a single utterance. Returns Int16 PCM at 16kHz mono.
	// The MVP implementation captures a fixed-duration window since the
	// phone app already invokes the pipeline only after a wake. VAD-based
	// end-of-speech detection can be added by piping the same mic into
	// an ASR session with `transcribeStream` from @qvac/sdk.
	private async captureUtterance(signal: AbortSignal): Promise<{
		samples: Int16Array
		sampleRate: number
	} | null> {
		const maxMs = this.opts.maxRecordMs ?? 6000
		// We don't have a direct expo-av binding here; production code wires
		// the WakeListener's frame stream into a small ring buffer. For now
		// we expose a "short-window" capture using the registered factory.
		const { captureUtterance: factory } = await import('./capture.ts')
		return factory(maxMs, signal)
	}

	private transcribe(
		audio: { samples: Int16Array; sampleRate: number },
		signal: AbortSignal,
	): Promise<string | null> {
		const modelId = this.opts.asrModelId ?? 'whisper-tiny-en-q4'
		return new Promise((resolve) => {
			let transcript = ''
			this.opts.inference
				.infer(
					{
						modelId,
						input: {
							audio: arrayBufferToBase64(audio.samples.buffer),
							sampleRate: audio.sampleRate,
						},
						stream: false,
					},
					(ev) => {
						if (ev.type === 'done') {
							const result = (ev.result as { text?: string } | undefined)?.text
							resolve(result ?? transcript ?? null)
						} else if (ev.type === 'delta') {
							const delta = (ev.delta as { text?: string } | undefined)?.text
							if (delta) transcript += delta
						} else if (ev.type === 'error') {
							resolve(null)
						}
					},
					signal,
				)
				.catch(() => resolve(null))
		})
	}

	private async infer(signal: AbortSignal): Promise<string | null> {
		const modelId = this.opts.llmModelId ?? 'mistral-7b-instruct-q4'
		// QVAC-native fast path: delegate directly to the worker's
		// QVAC provider when a public key is available.
		if (this.opts.qvac) {
			try {
				if (signal.aborted) return null
				let acc = ''
				for await (const delta of this.opts.qvac.consumer.completionStream(
					modelId,
					{ history: this.history },
					this.opts.qvac.providerPublicKey,
				)) {
					if (signal.aborted) return null
					acc += delta
				}
				return acc.trim() || null
			} catch (err) {
				// Fall through to MeshInference on QVAC error.
				if (signal.aborted) return null
			}
		}
		return new Promise((resolve) => {
			let acc = ''
			this.opts.inference
				.infer(
					{
						modelId,
						input: { messages: this.history },
						stream: true,
					},
					(ev) => {
						if (ev.type === 'delta') {
							const delta = (ev.delta as { text?: string } | undefined)?.text
							if (delta) acc += delta
						} else if (ev.type === 'done') {
							const final = (ev.result as { text?: string } | undefined)?.text
							resolve((final ?? acc).trim() || null)
						} else if (ev.type === 'error') {
							resolve(null)
						}
					},
					signal,
				)
				.catch(() => resolve(null))
		})
	}

	private async speak(text: string, signal: AbortSignal): Promise<void> {
		if (!this.opts.playAudio) return
		const modelId = this.opts.ttsModelId ?? 'kokoro-tts-tiny-v1'
		const samples = await this.tts(modelId, text, signal)
		if (!samples) return
		await this.opts.playAudio(samples.samples, samples.sampleRate)
	}

	private tts(
		modelId: string,
		text: string,
		signal: AbortSignal,
	): Promise<{ samples: Int16Array; sampleRate: number } | null> {
		return new Promise((resolve) => {
			let collected: Int16Array = new Int16Array(0)
			let sampleRate = 22050
			this.opts.inference
				.infer(
					{ modelId, input: { text }, stream: true },
					(ev) => {
						if (ev.type === 'delta') {
							const delta = ev.delta as
								| { samples?: number[]; sampleRate?: number }
								| undefined
							if (delta?.samples && delta.samples.length > 0) {
								const arr = Int16Array.from(delta.samples)
								collected = concatInt16(collected, arr)
								if (delta.sampleRate) sampleRate = delta.sampleRate
							}
						} else if (ev.type === 'done') {
							const result = ev.result as
								| { samples?: number[]; sampleRate?: number }
								| undefined
							if (result?.samples) {
								collected = Int16Array.from(result.samples)
								if (result.sampleRate) sampleRate = result.sampleRate
							}
							resolve({ samples: collected, sampleRate })
						} else if (ev.type === 'error') {
							resolve(null)
						}
					},
					signal,
				)
				.catch(() => resolve(null))
		})
	}
}

function concatInt16(a: Int16Array, b: Int16Array): Int16Array {
	const out = new Int16Array(a.length + b.length)
	out.set(a, 0)
	out.set(b, a.length)
	return out
}

function arrayBufferToBase64(buf: ArrayBufferLike): string {
	const bytes = new Uint8Array(buf as ArrayBuffer)
	let bin = ''
	for (let i = 0; i < bytes.length; i++)
		bin += String.fromCharCode(bytes[i] ?? 0)
	if (typeof globalThis.btoa === 'function') return globalThis.btoa(bin)
	// Fallback for non-browser environments (e.g. node tests).
	const nodeBuf = (
		globalThis as {
			Buffer?: {
				from: (s: string, enc: string) => { toString: (enc: string) => string }
			}
		}
	).Buffer
	if (nodeBuf) return nodeBuf.from(bin, 'binary').toString('base64')
	return ''
}
