// Thin QVAC consumer. All inference in OmniMesh flows through this
// type so we can stub it in tests and swap providers in a single
// place. The real implementation wraps @qvac/sdk; the test
// implementation is in packages/host/src/qvac/consumer.test.ts.

import { log } from '../log.ts'
import { loadQVACConfig } from './config.ts'
import { loadQVACSDK } from './loadSDK.ts'
import type { QVACDelegate, QVACSDK } from './types.ts'

export interface LoadModelArgs {
	modelId: string
	delegate?: QVACDelegate
}

export interface CompletionArgs {
	modelId: string
	delegate?: QVACDelegate
	input: unknown
}

export interface HeartbeatArgs {
	providerPublicKey: string
	timeoutMs?: number
}

export interface UnloadArgs {
	providerPublicKey: string
	modelId: string
}

export interface QVACConsumerLike {
	loadModel(args: LoadModelArgs): Promise<void>
	completion(args: CompletionArgs): Promise<unknown>
	completionStream(args: CompletionArgs): AsyncIterable<unknown>
	heartbeat(args: HeartbeatArgs): Promise<{ rttMs: number; reachable: boolean }>
	unload(args: UnloadArgs): Promise<void>
}

export class QVACConsumer implements QVACConsumerLike {
	constructor(private sdk: QVACSDK | null) {}

	private get timeoutDefault(): number {
		return loadQVACConfig().delegateTimeoutMs
	}

	async loadModel(args: LoadModelArgs): Promise<void> {
		if (!this.sdk) throw new Error('QVAC SDK not available')
		if (!args.delegate) throw new Error('loadModel requires a delegate')
		await this.sdk.loadModel({
			modelSrc: args.modelId,
			delegate: {
				providerPublicKey: args.delegate.providerPublicKey,
				timeout: args.delegate.timeout ?? this.timeoutDefault,
				fallbackToLocal: args.delegate.fallbackToLocal ?? true,
			},
		})
	}

	async completion(args: CompletionArgs): Promise<unknown> {
		if (!this.sdk) throw new Error('QVAC SDK not available')
		if (!args.delegate) throw new Error('completion requires a delegate')
		const run = this.sdk.completion({
			modelId: args.modelId,
			prompt:
				typeof args.input === 'string'
					? args.input
					: ((args.input as { prompt?: string })?.prompt ?? ''),
			history: (
				args.input as {
					history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
				}
			)?.history,
			stream: false,
			delegate: {
				providerPublicKey: args.delegate.providerPublicKey,
				timeout: args.delegate.timeout ?? this.timeoutDefault,
				fallbackToLocal: args.delegate.fallbackToLocal ?? true,
			},
		})
		let final: unknown = null
		for await (const ev of run.events) {
			if (ev.type === 'contentDelta' || ev.type === 'done') {
				if ('text' in ev && typeof ev.text === 'string') final = ev.text
			}
		}
		return final
	}

	async *completionStream(args: CompletionArgs): AsyncIterable<unknown> {
		if (!this.sdk) throw new Error('QVAC SDK not available')
		if (!args.delegate) throw new Error('completionStream requires a delegate')
		const run = this.sdk.completion({
			modelId: args.modelId,
			prompt:
				typeof args.input === 'string'
					? args.input
					: ((args.input as { prompt?: string })?.prompt ?? ''),
			history: (
				args.input as {
					history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
				}
			)?.history,
			stream: true,
			delegate: {
				providerPublicKey: args.delegate.providerPublicKey,
				timeout: args.delegate.timeout ?? this.timeoutDefault,
				fallbackToLocal: args.delegate.fallbackToLocal ?? true,
			},
		})
		for await (const ev of run.events) {
			if (ev.type === 'contentDelta') {
				yield (ev as { text?: string }).text ?? ''
			}
		}
	}

	async heartbeat(
		args: HeartbeatArgs,
	): Promise<{ rttMs: number; reachable: boolean }> {
		if (!this.sdk?.heartbeat) {
			// No SDK heartbeat; report unreachable. Callers fall back
			// to direct DHT probing.
			return { rttMs: -1, reachable: false }
		}
		const t0 = Date.now()
		const r = await this.sdk.heartbeat({
			delegate: {
				providerPublicKey: args.providerPublicKey,
				timeout: args.timeoutMs ?? 3000,
				fallbackToLocal: true,
			},
			timeout: args.timeoutMs ?? 3000,
		})
		return { rttMs: r.rttMs ?? Date.now() - t0, reachable: r.reachable }
	}

	async unload(args: UnloadArgs): Promise<void> {
		if (!this.sdk) return
		try {
			await this.sdk.unloadModel(args.modelId)
		} catch (err) {
			log.warn(`unload failed: ${(err as Error).message}`)
		}
	}
}

export function makeConsumer(sdk: QVACSDK | null): QVACConsumer {
	return new QVACConsumer(sdk)
}

export async function tryLoadQVAC(): Promise<QVACSDK | null> {
	try {
		return await loadQVACSDK()
	} catch (err) {
		log.warn(
			`@qvac/sdk not installed (${(err as Error).message}). Consumer disabled.`,
		)
		return null
	}
}
