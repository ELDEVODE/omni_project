import { describe, expect, test } from 'bun:test'
import { detectLanIP, isPrivateIPv4 } from './lan.ts'

describe('isPrivateIPv4', () => {
	test('accepts RFC1918 10/8', () => {
		expect(isPrivateIPv4('10.0.0.1')).toBe(true)
		expect(isPrivateIPv4('10.255.255.255')).toBe(true)
	})

	test('accepts RFC1918 172.16/12', () => {
		expect(isPrivateIPv4('172.16.0.1')).toBe(true)
		expect(isPrivateIPv4('172.31.255.254')).toBe(true)
	})

	test('accepts RFC1918 192.168/16', () => {
		expect(isPrivateIPv4('192.168.0.1')).toBe(true)
		expect(isPrivateIPv4('192.168.1.42')).toBe(true)
	})

	test('accepts link-local 169.254/16', () => {
		expect(isPrivateIPv4('169.254.1.1')).toBe(true)
	})

	test('rejects public addresses', () => {
		expect(isPrivateIPv4('8.8.8.8')).toBe(false)
		expect(isPrivateIPv4('1.1.1.1')).toBe(false)
		expect(isPrivateIPv4('172.32.0.1')).toBe(false)
		expect(isPrivateIPv4('172.15.0.1')).toBe(false)
	})

	test('rejects malformed strings', () => {
		expect(isPrivateIPv4('127.0.0.1')).toBe(false) // loopback
		expect(isPrivateIPv4('not-an-ip')).toBe(false)
		expect(isPrivateIPv4('')).toBe(false)
		expect(isPrivateIPv4('::1')).toBe(false)
		expect(isPrivateIPv4('fe80::1')).toBe(false)
	})
})

describe('detectLanIP', () => {
	test('returns a string or null (does not throw)', () => {
		const r = detectLanIP()
		if (r !== null) {
			expect(typeof r).toBe('string')
			expect(r.length).toBeGreaterThan(0)
		} else {
			expect(r).toBeNull()
		}
	})

	test('returns a valid IPv4 string when not null', () => {
		const r = detectLanIP()
		if (r !== null) {
			expect(r).toMatch(/^\d+\.\d+\.\d+\.\d+$/)
		}
	})
})
