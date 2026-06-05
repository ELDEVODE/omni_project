// Tests for the QVAC consumer wrapper. The real @qvac/sdk is an
// optional peer dep; in this test environment the dynamic import
// resolves to null. We exercise the no-SDK paths and the public
// surface.

import { describe, expect, test } from 'bun:test'
import {
	type CompletionArgs,
	type HeartbeatArgs,
	type LoadModelArgs,
	type UnloadArgs,
	makeConsumer,
} from './consumer.ts'

describe('QVAC consumer (no SDK)', () => {
	const noop = makeConsumer(null)

	test('loadModel throws when SDK is null', async () => {
		const args: LoadModelArgs = {
			modelId: 'm',
			delegate: { providerPublicKey: 'k' },
		}
		await expect(noop.loadModel(args)).rejects.toThrow('QVAC SDK not available')
	})

	test('completion throws when SDK is null', async () => {
		const args: CompletionArgs = {
			modelId: 'm',
			delegate: { providerPublicKey: 'k' },
			input: { prompt: 'hi' },
		}
		await expect(noop.completion(args)).rejects.toThrow(
			'QVAC SDK not available',
		)
	})

	test('completionStream throws when SDK is null', async () => {
		const args: CompletionArgs = {
			modelId: 'm',
			delegate: { providerPublicKey: 'k' },
			input: { prompt: 'hi' },
		}
		const iter = noop.completionStream(args)
		const next = iter[Symbol.asyncIterator]().next()
		await expect(next).rejects.toThrow('QVAC SDK not available')
	})

	test('heartbeat returns unreachable when SDK is null', async () => {
		const args: HeartbeatArgs = { providerPublicKey: 'k' }
		const r = await noop.heartbeat(args)
		expect(r.rttMs).toBe(-1)
		expect(r.reachable).toBe(false)
	})

	test('unload is a no-op when SDK is null', async () => {
		const args: UnloadArgs = { providerPublicKey: 'k', modelId: 'm' }
		await noop.unload(args)
		expect(true).toBe(true)
	})
})
