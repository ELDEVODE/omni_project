// Tests for the mobile QVAC consumer. The real @qvac/sdk is not
// installed in the test environment, so the consumer degrades to
// throwing on use.

import { describe, expect, test } from 'bun:test'
import {
	QVACConsumerImpl,
	fallbackToMeshInference,
	loadQVAC,
	pickProviderKey,
} from './consumer.ts'

describe('Mobile QVAC consumer', () => {
	test('loadQVAC returns null when SDK is missing', async () => {
		const sdk = await loadQVAC()
		expect(sdk).toBeNull()
	})

	test('QVACConsumerImpl throws on loadModel when SDK is null', async () => {
		const c = new QVACConsumerImpl(null)
		await expect(c.loadModel('m', 'k')).rejects.toThrow(
			'QVAC SDK not installed on this device',
		)
	})

	test('QVACConsumerImpl throws on completion when SDK is null', async () => {
		const c = new QVACConsumerImpl(null)
		await expect(c.completion('m', { prompt: 'hi' }, 'k')).rejects.toThrow(
			'QVAC SDK not installed on this device',
		)
	})

	test('fallbackToMeshInference throws on use', async () => {
		const c = fallbackToMeshInference()
		await expect(c.completion('m', { prompt: 'hi' }, 'k')).rejects.toThrow()
	})

	test('pickProviderKey returns null when no peer has a key', () => {
		const key = pickProviderKey(
			[
				{
					providerPublicKey: '',
					currentModels: [],
					directConnect: 'failed',
				},
			],
			'm',
		)
		expect(key).toBeNull()
	})

	test('pickProviderKey returns the public key of the first eligible peer', () => {
		const key = pickProviderKey(
			[
				{
					providerPublicKey: '',
					currentModels: [],
					directConnect: 'unknown',
				},
				{
					providerPublicKey: 'abc123',
					currentModels: ['m'],
					directConnect: 'connected',
				},
			],
			'm',
		)
		expect(key).toBe('abc123')
	})

	test('pickProviderKey prefers direct connect = connected', () => {
		const key = pickProviderKey(
			[
				{
					providerPublicKey: 'relayed',
					currentModels: [],
					directConnect: 'relayed',
				},
				{
					providerPublicKey: 'direct',
					currentModels: [],
					directConnect: 'connected',
				},
			],
			'm',
		)
		expect(key).toBe('direct')
	})

	test('pickProviderKey skips failed peers', () => {
		const key = pickProviderKey(
			[
				{
					providerPublicKey: 'broken',
					currentModels: [],
					directConnect: 'failed',
				},
				{
					providerPublicKey: 'good',
					currentModels: [],
					directConnect: 'connected',
				},
			],
			'm',
		)
		expect(key).toBe('good')
	})
})
