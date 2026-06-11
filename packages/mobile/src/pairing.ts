// Pairing URI parser for the mobile app — accepts
// omni://host?port=…&token=…&provider=<qvac-hex>&mesh=…
// and extracts the fields needed to connect to the host.

export type Pairing = {
	host: string
	port: number
	token: string
	// QVAC provider public key (hex). The host's QVAC provider key, if
	// any. Optional — the phone can still operate in relay-only mode
	// without it.
	providerKey?: string
	meshName?: string
}
import { decodePairing } from '../../cli/src/pairing.ts'

export function parsePairing(raw: string): Pairing | null {
	if (!raw) return null
	const decoded = decodePairing(raw.trim())
	if (!decoded || !decoded.host || !decoded.port) return null
	return {
		host: decoded.host,
		port: decoded.port,
		token: decoded.token,
		providerKey: decoded.providerPublicKey || undefined,
		meshName: decoded.meshName,
	}
}
