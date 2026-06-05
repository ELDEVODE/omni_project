// Persist the phone's pairing (host, port, token, mesh name) so the user
// doesn't have to re-scan every time the app launches.

import * as FileSystem from 'expo-file-system'
import type { Pairing } from './pairing.ts'

const FILE = `${FileSystem.documentDirectory ?? ''}omni-pairing.json`

let cache: Pairing | null = null

export async function loadPairing(): Promise<Pairing | null> {
	if (cache) return cache
	try {
		const info = await FileSystem.getInfoAsync(FILE)
		if (!info.exists) return null
		const text = await FileSystem.readAsStringAsync(FILE)
		const parsed = JSON.parse(text) as Pairing
		if (typeof parsed.host !== 'string' || typeof parsed.port !== 'number')
			return null
		cache = parsed
		return parsed
	} catch {
		return null
	}
}

export async function savePairing(p: Pairing): Promise<void> {
	cache = p
	try {
		await FileSystem.writeAsStringAsync(FILE, JSON.stringify(p))
	} catch (err) {
		console.warn('[pairing] failed to persist:', (err as Error).message)
	}
}

export async function clearPairing(): Promise<void> {
	cache = null
	try {
		const info = await FileSystem.getInfoAsync(FILE)
		if (info.exists) await FileSystem.deleteAsync(FILE, { idempotent: true })
	} catch {
		// ignore
	}
}
