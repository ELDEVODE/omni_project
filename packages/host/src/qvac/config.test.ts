// Tests for the QVAC config loader. The loader finds a qvac.config.json
// in cwd / parent / grandparent / ~/.qvac/config.json. When none is
// present, defaults are returned.

import { describe, expect, test } from 'bun:test'
import { loadQVACConfig } from './config.ts'

describe('QVAC config', () => {
	test('returns defaults when no config file is present', () => {
		const cfg = loadQVACConfig()
		expect(cfg.swarmRelays.length).toBeGreaterThan(0)
		expect(cfg.cacheDirectory).toContain('.qvac')
		expect(cfg.delegateTimeoutMs).toBeGreaterThan(0)
		expect(cfg.registryDownloadMaxRetries).toBeGreaterThan(0)
		expect(cfg.httpConnectionTimeoutMs).toBeGreaterThan(0)
		expect(cfg.httpDownloadConcurrency).toBeGreaterThan(0)
	})

	test('swarmRelays default to three public QVAC relays', () => {
		const cfg = loadQVACConfig()
		expect(cfg.swarmRelays).toHaveLength(3)
		for (const url of cfg.swarmRelays) {
			expect(url.startsWith('wss://')).toBe(true)
		}
	})

	test('loggerLevel defaults to info', () => {
		const cfg = loadQVACConfig()
		expect(cfg.loggerLevel).toBe('info')
	})
})
