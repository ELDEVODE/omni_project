import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type SecretStore, createSecretStore } from './secret-store.ts'

const TEST_DIR = path.join(
	os.tmpdir(),
	`omni-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
)
let store: SecretStore

beforeEach(() => {
	fs.rmSync(TEST_DIR, { recursive: true, force: true })
	fs.mkdirSync(TEST_DIR, { recursive: true })
	store = createSecretStore(TEST_DIR)
})

afterEach(() => {
	fs.rmSync(TEST_DIR, { recursive: true, force: true })
})

describe('secret-store', () => {
	test('ensureOmniDir creates the dir', () => {
		store.ensureOmniDir()
		const stat = fs.statSync(TEST_DIR)
		expect(stat.isDirectory()).toBe(true)
	})

	test('readSecret returns null when no file exists', () => {
		expect(store.readSecret()).toBeNull()
	})

	test('writeSecret + readSecret roundtrip', () => {
		const token = 'unit-test-token-abc123'
		store.writeSecret(token)
		expect(store.readSecret()).toBe(token)
		const stat = fs.statSync(store.getSecretPath())
		expect(stat.mode & 0o777).toBe(0o600)
	})

	test('generateSecret returns a 32-char base64url string', () => {
		const s = store.generateSecret()
		expect(s).toMatch(/^[A-Za-z0-9_-]{32}$/)
	})

	test('loadOrCreateSecret creates a new secret on first call', () => {
		const s = store.loadOrCreateSecret()
		expect(s).toMatch(/^[A-Za-z0-9_-]{32}$/)
		expect(store.readSecret()).toBe(s)
	})

	test('loadOrCreateSecret returns existing secret on subsequent calls', () => {
		const s1 = store.loadOrCreateSecret()
		const s2 = store.loadOrCreateSecret()
		expect(s1).toBe(s2)
	})

	test('rotateSecret returns a different value than the previous one', () => {
		const s1 = store.loadOrCreateSecret()
		const s2 = store.rotateSecret()
		expect(s1).not.toBe(s2)
		expect(store.readSecret()).toBe(s2)
	})

	test('loadAuthToken reads from OMNI_SECRET env when set', () => {
		process.env.OMNI_SECRET = 'env-token-xyz'
		expect(store.loadAuthToken()).toBe('env-token-xyz')
		delete process.env.OMNI_SECRET
	})

	test('loadAuthToken falls back to file when env is not set', () => {
		delete process.env.OMNI_SECRET
		store.writeSecret('file-token-456')
		expect(store.loadAuthToken()).toBe('file-token-456')
	})
})
