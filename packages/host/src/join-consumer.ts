import path from 'node:path'
import { log } from './log.ts'
import { makeConsumer, tryLoadQVAC } from './qvac/consumer.ts'

export type ConsumerConfig = {
	providerPublicKey: string
	name?: string
	alwaysOnVoice?: boolean
	secret?: string
}

function primeNodePath(): void {
	try {
		const r = Bun.spawnSync({
			cmd: ['npm', 'root', '-g'],
			env: process.env,
			timeout: 3_000,
		})
		if (r.exitCode !== 0) return
		const root = new TextDecoder().decode(r.stdout).trim()
		if (!root) return
		const parent = path.dirname(root)
		const existing = process.env.NODE_PATH ?? ''
		const sep = process.platform === 'win32' ? ';' : ':'
		const parts = existing ? existing.split(sep) : []
		if (!parts.includes(parent)) {
			process.env.NODE_PATH = parts.length
				? `${parts.join(sep)}${sep}${parent}`
				: parent
		}
	} catch {
		// best-effort
	}
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
		await consumer.loadModel({
			modelId: 'default',
			delegate: {
				providerPublicKey,
				timeout: 60_000,
				fallbackToLocal: true,
			},
		})
		bootProgress('connect', 'delegated model ready')
		log.info('Delegated model loaded successfully')
	} catch (err) {
		bootProgress('connect', `failed: ${(err as Error).message}`)
		log.warn(`Failed to load delegated model: ${(err as Error).message}`)
	}

	bootProgress('ready', 'consumer online')
	log.info('Consumer ready. Press Ctrl+C to stop.')
	process.stdin.resume()
}
