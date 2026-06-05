import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function defaultOmniDir(): string {
	return path.join(os.homedir(), '.omni')
}

export type SecretStore = {
	ensureOmniDir: () => void
	readSecret: () => string | null
	writeSecret: (secret: string) => void
	generateSecret: () => string
	loadOrCreateSecret: () => string
	rotateSecret: () => string
	getSecretPath: () => string
	loadAuthToken: () => string | null
}

export function createSecretStore(dir: string = defaultOmniDir()): SecretStore {
	const secretPath = path.join(dir, 'secret')

	function readSecret(): string | null {
		try {
			return fs.readFileSync(secretPath, 'utf8').trim()
		} catch {
			return null
		}
	}
	function writeSecret(secret: string): void {
		fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
		fs.writeFileSync(secretPath, secret, { mode: 0o600 })
	}
	function generateSecret(): string {
		return crypto.randomBytes(24).toString('base64url')
	}
	function loadOrCreateSecret(): string {
		const existing = readSecret()
		if (existing) return existing
		const fresh = generateSecret()
		writeSecret(fresh)
		return fresh
	}
	function rotateSecret(): string {
		const fresh = generateSecret()
		writeSecret(fresh)
		return fresh
	}
	function loadAuthToken(): string | null {
		if (process.env.OMNI_SECRET) return process.env.OMNI_SECRET
		return readSecret()
	}

	return {
		ensureOmniDir(): void {
			fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
		},
		readSecret,
		writeSecret,
		generateSecret,
		loadOrCreateSecret,
		rotateSecret,
		getSecretPath(): string {
			return secretPath
		},
		loadAuthToken,
	}
}

const defaultStore = createSecretStore()

export const ensureOmniDir = defaultStore.ensureOmniDir
export const readSecret = defaultStore.readSecret
export const writeSecret = defaultStore.writeSecret
export const generateSecret = defaultStore.generateSecret
export const loadOrCreateSecret = defaultStore.loadOrCreateSecret
export const rotateSecret = defaultStore.rotateSecret
export const getSecretPath = defaultStore.getSecretPath
export const loadAuthToken = defaultStore.loadAuthToken
