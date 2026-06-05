// Unit tests for the openWakeWord bridge. The native module is not linked
// in test environments, so most tests assert graceful no-ops.

import { describe, expect, it } from 'bun:test'
import { oww } from './oww.ts'

describe('openWakeWord bridge', () => {
	it('reports unavailable when native module is not linked', () => {
		expect(oww.isAvailable()).toBe(false)
	})

	it('init() throws when the native module is missing', async () => {
		await expect(oww.init({ keyword: 'omni' })).rejects.toThrow()
	})

	it('pushSamples() returns no detection when uninitialised', async () => {
		const result = await oww.pushSamples(new Float32Array(1600), 16000)
		expect(result).toEqual({ score: 0, detected: false })
	})

	it('close() is a no-op when uninitialised', async () => {
		await oww.close()
	})
})
