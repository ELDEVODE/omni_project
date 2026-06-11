// qvac.config.json loader. The QVAC SDK reads this file at native
// init time; we also read it for the consumer-side timeout /
// fallback defaults.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type QVACConfig = {
	swarmRelays: string[]
	cacheDirectory: string
	registryDownloadMaxRetries: number
	httpConnectionTimeoutMs: number
	httpDownloadConcurrency: number
	delegateTimeoutMs: number
	loggerLevel: 'debug' | 'info' | 'warn' | 'error'
}

const DEFAULTS: QVACConfig = {
	swarmRelays: [
		'wss://relay-01.qvac.ai',
		'wss://relay-02.qvac.ai',
		'wss://relay-03.qvac.ai',
	],
	cacheDirectory: path.join(os.homedir(), '.qvac', 'models'),
	registryDownloadMaxRetries: 3,
	httpConnectionTimeoutMs: 10_000,
	httpDownloadConcurrency: 4,
	delegateTimeoutMs: 30_000,
	loggerLevel: 'info',
}

function findConfigFile(): string | null {
	const candidates = [
		path.resolve(process.cwd(), 'qvac.config.json'),
		path.resolve(process.cwd(), '..', 'qvac.config.json'),
		path.resolve(process.cwd(), '..', '..', 'qvac.config.json'),
		path.resolve(os.homedir(), '.qvac', 'config.json'),
	]
	for (const c of candidates) {
		if (fs.existsSync(c)) return c
	}
	return null
}

function expandPath(filepath: string): string {
	if (filepath.startsWith('~')) {
		return path.join(os.homedir(), filepath.slice(1))
	}
	// Expand environment variables like %USERPROFILE% or $HOME
	return filepath
		.replace(/%([^%]+)%/g, (_, n) => process.env[n] || `%${n}%`)
		.replace(/\$([A-Z_]+)/g, (_, n) => process.env[n] || `$${n}`)
}

export function loadQVACConfig(): QVACConfig {
	const file = findConfigFile()
	if (!file) return DEFAULTS
	try {
		const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
		const merged = { ...DEFAULTS, ...raw }
		merged.cacheDirectory = expandPath(merged.cacheDirectory)
		return merged
	} catch {
		return DEFAULTS
	}
}
