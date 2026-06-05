import { describe, expect, test } from 'bun:test'
import { validatePairingToken } from './config.ts'

describe('validatePairingToken', () => {
	test('returns true when no expected secret is set (no-auth mode)', () => {
		expect(validatePairingToken(null, null)).toBe(true)
		expect(validatePairingToken('anything', null)).toBe(true)
		expect(validatePairingToken(null, '')).toBe(true)
	})

	test('returns false when expected secret is set but no token provided', () => {
		expect(validatePairingToken(null, 'abc123')).toBe(false)
		expect(validatePairingToken('', 'abc123')).toBe(false)
	})

	test('returns true on exact match', () => {
		expect(validatePairingToken('abc123', 'abc123')).toBe(true)
	})

	test('returns false on length mismatch', () => {
		expect(validatePairingToken('abc', 'abcd')).toBe(false)
		expect(validatePairingToken('abcd', 'abc')).toBe(false)
	})

	test('returns false on single-character mismatch', () => {
		expect(validatePairingToken('abc123', 'abc124')).toBe(false)
		expect(validatePairingToken('abc123', 'xbc123')).toBe(false)
		expect(validatePairingToken('abc123', 'abc12')).toBe(false)
	})

	test('handles long base64url secrets', () => {
		const secret = 'ciwTVgowriBwFEUl5AXsZ1Au2cL1zGvn'
		expect(validatePairingToken(secret, secret)).toBe(true)
		expect(validatePairingToken(`${secret}X`, secret)).toBe(false)
		expect(validatePairingToken(secret.slice(0, -1), secret)).toBe(false)
	})

	test('handles unicode / special chars without leaking length via early-exit', () => {
		const secret = 'pässwörd-!@#$%^&*()'
		expect(validatePairingToken(secret, secret)).toBe(true)
		expect(validatePairingToken('pässwörd-!@#$%^&*()X', secret)).toBe(false)
	})
})
