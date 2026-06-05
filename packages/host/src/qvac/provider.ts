// @qvac/sdk is an optional peer dependency. The wrapper is designed to
// boot in three modes:
//   - "absent"   — SDK not installed; provider is a no-op, consumer
//                   throws on use
//   - "host"     — host runs a QVAC provider; the dashboard can do
//                   QVAC inference even without any worker
//   - "consumer" — host delegates every inference call to a remote
//                   provider via loadModel({ delegate })
//
// We pick the mode from env / config at boot.

import { log } from '../log.ts'
import { loadQVACConfig } from './config.ts'
import type { QVACSDK } from './types.ts'

export interface StartProviderOptions {
	seed?: string
	firewall?: { mode: 'allow' | 'block'; publicKeys?: string[]; allowEmpty?: boolean }
	swarmRelays?: string[]
	cacheDirectory?: string
	loggerLevel?: 'debug' | 'info' | 'warn' | 'error'
}

export type QVACMode = 'absent' | 'provider' | 'consumer' | 'hybrid'

export class QVACProvider {
	private sdk: QVACSDK | null = null
	publicKey = ''
	ready = false
	loadedModels: string[] = []

	async start(opts: StartProviderOptions = {}): Promise<void> {
		try {
			const mod = (await import(/* @vite-ignore */ '@qvac/sdk' as string)) as
				| QVACSDK
				| undefined
			if (!mod) {
				log.warn('@qvac/sdk not present. QVAC provider disabled.')
				return
			}
			this.sdk = mod
		} catch (err) {
			log.warn(
				`@qvac/sdk not installed (${(err as Error).message}). QVAC provider disabled.`,
			)
			return
		}
		const cfg = loadQVACConfig()
		try {
			const handle = await this.sdk.startQVACProvider?.({
				loggerLevel: opts.loggerLevel ?? cfg.loggerLevel,
				cacheDirectory: opts.cacheDirectory ?? cfg.cacheDirectory,
				swarmRelays: opts.swarmRelays ?? cfg.swarmRelays,
				firewall: opts.firewall ?? { mode: 'allow', allowEmpty: true },
				seed: opts.seed,
			})
			if (!handle) {
				log.warn(
					'QVAC provider API not present in SDK; continuing as consumer only',
				)
				return
			}
			this.publicKey = handle.publicKey
			this.ready = true
			log.info(
				`QVAC provider online — public key ${this.publicKey.slice(0, 16)}…`,
			)
		} catch (err) {
			log.warn(`startQVACProvider failed: ${(err as Error).message}`)
		}
	}

	async stop(): Promise<void> {
		if (!this.sdk || !this.ready) return
		try {
			await this.sdk.stopQVACProvider?.()
		} catch (err) {
			log.warn(`stopQVACProvider failed: ${(err as Error).message}`)
		}
		this.ready = false
		this.publicKey = ''
	}

	trackLoadedModel(modelId: string): void {
		if (!this.loadedModels.includes(modelId)) this.loadedModels.push(modelId)
	}

	untrackLoadedModel(modelId: string): void {
		this.loadedModels = this.loadedModels.filter((m) => m !== modelId)
	}

	getSDK(): QVACSDK | null {
		return this.sdk
	}
}
