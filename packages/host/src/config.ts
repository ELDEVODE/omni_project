import { existsSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const HOST_DEFAULTS = {
	port: 3005,
	host: '0.0.0.0',
	meshName: 'omni-mesh',
	protocolVersion: 1 as const,
	corsOrigins: ['*'] as const,
}

export type HostConfig = {
	port: number
	host: string
	meshName: string
	protocolVersion: number
	corsOrigins: readonly string[]
	enableLocalDiscoveryOnly: boolean
	secret: string | null
	publicHost: string | null
	openaiPort?: number
}

const SECRET_CANDIDATES = [
	process.env.OMNI_SECRET,
	(() => {
		try {
			return readFileSync(
				path.join(os.homedir(), '.omni', 'secret'),
				'utf8',
			).trim()
		} catch {
			return undefined
		}
	})(),
	(() => {
		const local = path.resolve(process.cwd(), '.omni-secret')
		return existsSync(local) ? readFileSync(local, 'utf8').trim() : undefined
	})(),
].filter((s): s is string => Boolean(s && s.length > 0))

function resolveSecret(): string | null {
	return SECRET_CANDIDATES[0] ?? null
}

export function loadConfig(overrides: Partial<HostConfig> = {}): HostConfig {
	process.env.QVAC_LOCAL_DISCOVERY_ONLY = '1'
	const portFromEnv = process.env.OMNI_PORT
	const meshNameFromEnv = process.env.OMNI_MESH_NAME
	const publicHost = process.env.OMNI_PUBLIC_HOST ?? null
	return {
		...HOST_DEFAULTS,
		...(portFromEnv ? { port: Number(portFromEnv) } : {}),
		...(meshNameFromEnv ? { meshName: meshNameFromEnv } : {}),
		enableLocalDiscoveryOnly: true,
		secret: resolveSecret(),
		publicHost,
		...overrides,
	}
}

export function validatePairingToken(
	provided: string | null,
	expected: string | null,
): boolean {
	if (!expected) return true
	if (!provided) return false
	if (provided.length !== expected.length) return false
	let mismatch = 0
	for (let i = 0; i < provided.length; i++) {
		mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
	}
	return mismatch === 0
}
