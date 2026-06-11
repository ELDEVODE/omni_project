import { log } from './log.ts'
import { makeConsumer, tryLoadQVAC } from './qvac/consumer.ts'
import { primeNodePath } from './util.ts'

export type ConsumerConfig = {
	providerPublicKey: string
	name?: string
	alwaysOnVoice?: boolean
	secret?: string
}

primeNodePath()

function bootProgress(phase: string, message: string): void {
	process.stderr.write(`[boot] ${phase}: ${message}\n`)
}

export async function startConsumer(config: ConsumerConfig): Promise<void> {
	const { providerPublicKey, name, alwaysOnVoice, secret } = config

	if (secret) {
		process.env.OMNI_SECRET = secret
	}
	if (name) {
		process.env.OMNI_NODE_NAME = name
	}
	if (alwaysOnVoice) {
		process.env.OMNI_ALWAYS_ON_VOICE = '1'
	}
	process.env.OMNI_PROVIDER_PUBLIC_KEY = providerPublicKey

	log.info('Starting QVAC consumer…', {
		providerPublicKey: `${providerPublicKey.slice(0, 16)}…`,
	})

	bootProgress('sdk', 'loading @qvac/sdk…')
	const sdk = await tryLoadQVAC()
	if (!sdk) {
		bootProgress('sdk', 'failed (@qvac/sdk not installed)')
		log.error('@qvac/sdk not installed. Cannot run as consumer.')
		return
	}
	bootProgress('sdk', 'loaded')

	const consumer = makeConsumer(sdk)

	bootProgress(
		'connect',
		`dialling provider ${providerPublicKey.slice(0, 16)}…`,
	)
	try {
		const hb = await consumer.heartbeat({
			providerPublicKey,
			timeoutMs: 60_000,
		})
		if (!hb.reachable) {
			throw new Error('Provider unreachable')
		}
		bootProgress('connect', `connected (ping ${hb.rttMs}ms)`)
		log.info(`Connected to provider (rtt: ${hb.rttMs}ms)`)
	} catch (err) {
		bootProgress('connect', `failed: ${(err as Error).message}`)
		log.warn(`Failed to connect to provider: ${(err as Error).message}`)
	}

	bootProgress('ready', 'consumer online')
	log.info('Consumer ready. Press Ctrl+C to stop.')
	process.stdin.resume()
}
