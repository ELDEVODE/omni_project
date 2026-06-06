import { log } from './log.ts'
import { makeConsumer, tryLoadQVAC } from './qvac/consumer.ts'

// Extend NODE_PATH with the global npm modules root so the dynamic
// `import('@qvac/sdk')` in consumer.ts / provider.ts can find a
// package installed via `npm install -g @qvac/sdk` after `omni
// install qvac`. Same hook lives in host/src/index.ts — keep them
// in sync.
function primeNodePath(): void {
	try {
		const r = Bun.spawnSync({
			cmd: ['npm', 'root', '-g'],
			env: process.env,
		})
		if (r.exitCode !== 0) return
		const root = new TextDecoder().decode(r.stdout).trim()
		if (!root) return
		const existing = process.env.NODE_PATH ?? ''
		const sep = process.platform === 'win32' ? ';' : ':'
		const parts = existing ? existing.split(sep) : []
		if (!parts.includes(root)) {
			process.env.NODE_PATH = parts.length
				? `${parts.join(sep)}${sep}${root}`
				: root
		}
	} catch {
		// best-effort
	}
}
primeNodePath()

const providerPublicKey: string = process.env.OMNI_PROVIDER_PUBLIC_KEY ?? ''

if (!providerPublicKey) {
	log.error('OMNI_PROVIDER_PUBLIC_KEY not set')
	process.exit(1)
}

// bootProgress(phase, message) — mirror of the one in index.ts so the
// `omni join` stepper can advance the same way. Format MUST stay
// `[boot] <phase>: <message>`.
function bootProgress(phase: string, message: string): void {
	process.stderr.write(`[boot] ${phase}: ${message}\n`)
}

async function startConsumer(): Promise<void> {
	log.info('Starting QVAC consumer…', {
		providerPublicKey: `${providerPublicKey.slice(0, 16)}…`,
	})

	bootProgress('sdk', 'loading @qvac/sdk…')
	const sdk = await tryLoadQVAC()
	if (!sdk) {
		bootProgress('sdk', 'failed (@qvac/sdk not installed)')
		log.error('@qvac/sdk not installed. Cannot run as consumer.')
		process.exit(1)
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

startConsumer().catch((err) => {
	log.error('Consumer failed', { error: (err as Error).message })
	process.exit(1)
})
