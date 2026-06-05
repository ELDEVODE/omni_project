import { describe, expect, test } from 'bun:test'
import { decodePairing, encodePairing, renderPairingHint } from './pairing.ts'

describe('pairing codec (QVAC provider public key format)', () => {
	test('round-trips basic payload', () => {
		const encoded = encodePairing({
			providerPublicKey: 'a'.repeat(64),
			token: 'abc123',
		})
		expect(encoded).toBe(`omni://${'a'.repeat(64)}?token=abc123`)
		const decoded = decodePairing(encoded)
		expect(decoded).toEqual({
			providerPublicKey: 'a'.repeat(64),
			token: 'abc123',
		})
	})

	test('preserves meshName when present', () => {
		const encoded = encodePairing({
			providerPublicKey: 'b'.repeat(64),
			token: 'tok',
			meshName: 'studio',
		})
		expect(encoded).toBe(`omni://${'b'.repeat(64)}?token=tok&mesh=studio`)
		const decoded = decodePairing(encoded)
		expect(decoded?.meshName).toBe('studio')
		expect(decoded?.providerPublicKey).toBe('b'.repeat(64))
		expect(decoded?.token).toBe('tok')
	})

	test('rejects non-omni:// scheme', () => {
		expect(decodePairing('http://example.com')).toBeNull()
		expect(decodePairing('omni:host')).toBeNull()
	})

	test('rejects missing required fields', () => {
		expect(decodePairing('omni://')).toBeNull()
		expect(decodePairing('omni://pubkey')).toBeNull()
		expect(decodePairing('omni://pubkey?token=')).toBeNull()
	})

	test('rejects malformed URI', () => {
		expect(decodePairing('omni://?')).toBeNull()
	})

	test('renderPairingHint produces a multi-line string with the pubkey and token', () => {
		const out = renderPairingHint({
			providerPublicKey: 'c'.repeat(64),
			token: 'a'.repeat(24),
		})
		expect(out).toContain(`omni://${'c'.repeat(64)}`)
		expect(out).toContain('token: aaaaaaaaaaaaaaaa')
		expect(out).toContain('omni join')
	})

	test('encoder output is what the host command prints in the omni:// line', () => {
		const encoded = encodePairing({
			providerPublicKey: 'd'.repeat(64),
			token: 'abc',
			meshName: 'studio',
		})
		expect(encoded).toBe(`omni://${'d'.repeat(64)}?token=abc&mesh=studio`)
		const decoded = decodePairing(encoded)
		expect(decoded).toEqual({
			providerPublicKey: 'd'.repeat(64),
			token: 'abc',
			meshName: 'studio',
		})
	})
})
