// QVAC consumer for the mobile app. In Phase 7R the phone is a QVAC
// consumer — it loads models directly from a worker via
// loadModel({ delegate: { providerPublicKey, timeout, fallbackToLocal: true } })
// rather than going through the host's HTTP endpoints.
//
// The @qvac/sdk module is an optional peer dep. When it's not
// installed, the consumer degrades to throwing on use; the host's
// HTTP API path is the documented fallback in that case.

import type { MeshInference } from '../mesh/inference.ts'

export type QVACConsumer = {
	loadModel(modelId: string, providerPublicKey: string): Promise<void>
	completion(
		modelId: string,
		input: {
			history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
			prompt?: string
		},
		providerPublicKey: string,
	): Promise<string>
	completionStream(
		modelId: string,
		input: {
			history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
			prompt?: string
		},
		providerPublicKey: string,
	): AsyncIterable<string>
	heartbeat(
		providerPublicKey: string,
		timeoutMs?: number,
	): Promise<{ rttMs: number; reachable: boolean }>
}

export type QVACSDK = {
	loadModel: (opts: {
		modelSrc: string
		delegate: {
			providerPublicKey: string
			timeout?: number
			fallbackToLocal?: boolean
		}
	}) => Promise<string>
	unloadModel: (modelId: string) => Promise<void>
	completion: (opts: {
		modelId: string
		history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
		prompt?: string
		stream?: boolean
		delegate: {
			providerPublicKey: string
			timeout?: number
			fallbackToLocal?: boolean
		}
	}) => { events: AsyncIterable<{ type: string; text?: string }> }
	heartbeat?: (opts: {
		delegate: {
			providerPublicKey: string
			timeout?: number
			fallbackToLocal?: boolean
		}
		timeout?: number
	}) => Promise<{ rttMs: number; reachable: boolean }>
	suspend?: () => Promise<void>
	resume?: () => Promise<void>
}

// loadQVAC returns the native SDK or null. Wrapped in an async function
// so the import is dynamic.
let cachedSDK: QVACSDK | null | undefined

export async function loadQVAC(): Promise<QVACSDK | null> {
	if (cachedSDK !== undefined) return cachedSDK
	try {
		const mod = (await import(/* @vite-ignore */ '@qvac/sdk' as string)) as {
			default?: QVACSDK
		} & QVACSDK
		cachedSDK = (mod.default ?? mod) as QVACSDK
		return cachedSDK
	} catch {
		cachedSDK = null
		return null
	}
}

export class QVACConsumerImpl implements QVACConsumer {
	constructor(private sdk: QVACSDK | null) {}

	async loadModel(modelId: string, providerPublicKey: string): Promise<void> {
		if (!this.sdk) throw new Error('QVAC SDK not installed on this device')
		await this.sdk.loadModel({
			modelSrc: modelId,
			delegate: {
				providerPublicKey,
				timeout: 30_000,
				fallbackToLocal: true,
			},
		})
	}

	async completion(
		modelId: string,
		input: {
			history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
			prompt?: string
		},
		providerPublicKey: string,
	): Promise<string> {
		if (!this.sdk) throw new Error('QVAC SDK not installed on this device')
		const run = this.sdk.completion({
			modelId,
			history: input.history,
			prompt: input.prompt,
			stream: false,
			delegate: {
				providerPublicKey,
				timeout: 60_000,
				fallbackToLocal: true,
			},
		})
		let acc = ''
		for await (const ev of run.events) {
			if (ev.type === 'contentDelta' && typeof ev.text === 'string')
				acc += ev.text
		}
		return acc
	}

	async *completionStream(
		modelId: string,
		input: {
			history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
			prompt?: string
		},
		providerPublicKey: string,
	): AsyncIterable<string> {
		if (!this.sdk) throw new Error('QVAC SDK not installed on this device')
		const run = this.sdk.completion({
			modelId,
			history: input.history,
			prompt: input.prompt,
			stream: true,
			delegate: {
				providerPublicKey,
				timeout: 60_000,
				fallbackToLocal: true,
			},
		})
		for await (const ev of run.events) {
			if (ev.type === 'contentDelta' && typeof ev.text === 'string')
				yield ev.text
		}
	}

	async heartbeat(
		providerPublicKey: string,
		timeoutMs = 3000,
	): Promise<{ rttMs: number; reachable: boolean }> {
		if (!this.sdk?.heartbeat) {
			return { rttMs: -1, reachable: true }
		}
		return this.sdk.heartbeat({
			delegate: {
				providerPublicKey,
				timeout: timeoutMs,
				fallbackToLocal: true,
			},
			timeout: timeoutMs,
		})
	}

	async suspend(): Promise<void> {
		await this.sdk?.suspend?.()
	}

	async resume(): Promise<void> {
		await this.sdk?.resume?.()
	}
}

// Find the best provider public key for a given model. Prefers
// direct-connect peers, then those with a recent heartbeat, and
// finally any eligible peer. Skips `failed` direct connections.
export function pickProviderKey(
	peers: {
		providerPublicKey: string
		currentModels: string[]
		directConnect: string
		heartbeatRttMs?: number
		lastHeartbeatMs?: number | null
	}[],
	modelId: string,
): string | null {
	const eligible = peers.filter(
		(p) =>
			p.providerPublicKey &&
			(p.currentModels.length === 0 || p.currentModels.includes(modelId)) &&
			p.directConnect !== 'failed',
	)
	if (eligible.length === 0) return null
	const scored = eligible
		.map((p) => {
			let s = 0
			if (p.directConnect === 'connected') s += 100
			if (p.lastHeartbeatMs !== null && p.lastHeartbeatMs !== undefined) {
				const age = Date.now() - p.lastHeartbeatMs
				if (age < 5_000) s += 50
			}
			if (typeof p.heartbeatRttMs === 'number' && p.heartbeatRttMs >= 0) {
				s -= p.heartbeatRttMs / 10
			}
			return { p, s }
		})
		.sort((a, b) => b.s - a.s)
	return scored[0]?.p.providerPublicKey ?? null
}

// Bridge: when QVAC is unavailable, fall back to MeshInference (the
// legacy HTTP path through the host).
export function fallbackToMeshInference(): QVACConsumer {
	return {
		loadModel: async () => {
			throw new Error(
				'QVAC SDK not installed; voice pipeline should use MeshInference path',
			)
		},
		completion: async () => {
			throw new Error(
				'QVAC SDK not installed; voice pipeline should use MeshInference path',
			)
		},
		completionStream: async function* () {
			yield ''
		},
		heartbeat: async () => ({ rttMs: -1, reachable: false }),
	}
}

// Type guard: a MeshInference object satisfies a small subset of the
// QVACConsumer surface (used for tests).
export function asInference(mesh: MeshInference): {
	completion(prompt: string, modelId: string): Promise<string>
} {
	return {
		completion: async (prompt, modelId) => {
			let acc = ''
			await mesh.infer({ modelId, input: { prompt }, stream: true }, (ev) => {
				if (ev.type === 'delta') {
					const delta = (ev.delta as { text?: string } | undefined)?.text
					if (delta) acc += delta
				}
			})
			return acc
		},
	}
}
