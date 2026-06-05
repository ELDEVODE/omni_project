import { log } from './log.ts'
import { makeConsumer, tryLoadQVAC } from './qvac/consumer.ts'

const providerPublicKey: string = process.env.OMNI_PROVIDER_PUBLIC_KEY ?? ''

if (!providerPublicKey) {
	log.error('OMNI_PROVIDER_PUBLIC_KEY not set')
	process.exit(1)
}

async function startConsumer(): Promise<void> {
	log.info('Starting QVAC consumer…', {
		providerPublicKey: `${providerPublicKey.slice(0, 16)}…`,
	})

	const sdk = await tryLoadQVAC()
	if (!sdk) {
		log.error('@qvac/sdk not installed. Cannot run as consumer.')
		process.exit(1)
	}

	const consumer = makeConsumer(sdk)

	try {
		await consumer.loadModel({
			modelId: 'default',
			delegate: {
				providerPublicKey,
				timeout: 60_000,
				fallbackToLocal: true,
			},
		})
		log.info('Delegated model loaded successfully')
	} catch (err) {
		log.warn(`Failed to load delegated model: ${(err as Error).message}`)
	}

	log.info('Consumer ready. Press Ctrl+C to stop.')
	process.stdin.resume()
}

startConsumer().catch((err) => {
	log.error('Consumer failed', { error: (err as Error).message })
	process.exit(1)
})
