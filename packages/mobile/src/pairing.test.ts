import { describe, expect, test } from 'bun:test'
import { parsePairing } from './pairing.ts'

describe('parsePairing', () => {
	test('parses a minimal omni:// URI', () => {
		const r = parsePairing('omni://studio.local?port=3005&token=abc123')
		expect(r).toEqual({ host: 'studio.local', port: 3005, token: 'abc123' })
	})

	test('parses full URI with provider key and mesh name', () => {
		const p = parsePairing(
			'omni://192.168.0.10?port=3005&token=abc&provider=ppppp&mesh=m1',
		)
		expect(p?.providerKey).toBe('ppppp')
		expect(p?.meshName).toBe('m1')
	})

	test('accepts http:// URLs as fallback', () => {
		const r = parsePairing('http://10.0.0.1:3005?token=zzz')
		expect(r).toBeNull()
	})

	test('rejects missing token', () => {
		expect(parsePairing('omni://host?port=3005')).toBeNull()
	})

	test('rejects missing port', () => {
		expect(parsePairing('omni://host?token=abc')).toBeNull()
	})

	test('rejects non-numeric port', () => {
		expect(parsePairing('omni://host?port=NaN&token=abc')).toBeNull()
	})

	test('rejects out-of-range port', () => {
		expect(parsePairing('omni://host?port=0&token=abc')).toBeNull()
		expect(parsePairing('omni://host?port=99999&token=abc')).toBeNull()
	})

	test('rejects empty string', () => {
		expect(parsePairing('')).toBeNull()
		expect(parsePairing('   ')).toBeNull()
	})

	test('rejects random text', () => {
		expect(parsePairing('not a url')).toBeNull()
	})

	test('preserves IP address hostnames', () => {
		const r = parsePairing('omni://192.168.1.42?port=3005&token=abc')
		expect(r?.host).toBe('192.168.1.42')
	})

	test('handles trailing whitespace', () => {
		const r = parsePairing('  omni://host?port=3005&token=abc  ')
		expect(r?.host).toBe('host')
	})
})
