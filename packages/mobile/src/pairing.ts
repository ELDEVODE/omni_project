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

export function parsePairing(raw: string): Pairing | null {
	if (!raw) return null
	const trimmed = raw.trim()
	let url: URL
	try {
		const normalized = trimmed.startsWith('omni://')
			? trimmed.replace(/^omni:\/\//, 'http://')
			: trimmed
		url = new URL(normalized)
	} catch {
		return null
	}
	if (!trimmed.startsWith('omni://') && !trimmed.startsWith('http')) {
		return null
	}
	const hostname = url.hostname
	if (!hostname) return null
	const portStr = url.searchParams.get('port')
	const token = url.searchParams.get('token')
	if (!portStr || !token) return null
	const port = Number(portStr)
	if (!Number.isFinite(port) || port < 1 || port > 65535) return null
	// Accept both the new `provider=` (QVAC) and the legacy `p2p=`
	// (QVAC P2P) for backwards compatibility.
	const providerKey =
		url.searchParams.get('provider') ?? url.searchParams.get('p2p') ?? undefined
	const meshName = url.searchParams.get('mesh') ?? undefined
	return {
		host: hostname,
		port,
		token,
		...(providerKey ? { providerKey } : {}),
		...(meshName ? { meshName } : {}),
	}
}
