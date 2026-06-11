// Encode a payload as an omni:// URI suitable for QR-code generation or copy/paste.
//
// Format: omni://<providerPublicKey>?token=<token>
//
// The providerPublicKey is the QVAC provider's ed25519 public key (hex).
// No port, no host — the Hyperswarm DHT resolves the provider by public key.

export type PairingPayload = {
	host?: string
	port?: number
	providerPublicKey: string
	token: string
	meshName?: string
}

export function encodePairing(p: PairingPayload): string {
	const params = new URLSearchParams()
	params.set('token', p.token)
	if (p.meshName) params.set('mesh', p.meshName)

	if (p.host && p.port) {
		params.set('port', String(p.port))
		if (p.providerPublicKey) params.set('provider', p.providerPublicKey)
		const query = params.toString()
		return `omni://${p.host}${query ? `?${query}` : ''}`
	} else {
		const query = params.toString()
		return `omni://${p.providerPublicKey}${query ? `?${query}` : ''}`
	}
}

export function decodePairing(uri: string): PairingPayload | null {
	if (!uri.startsWith('omni://')) return null
	try {
		const url = new URL(uri.replace('omni://', 'http://'))
		const hostname = url.hostname
		if (!hostname) return null

		const token = url.searchParams.get('token')
		if (!token) return null

		const meshName = url.searchParams.get('mesh') ?? undefined
		const portStr = url.searchParams.get('port')

		if (portStr) {
			const port = Number(portStr)
			if (!Number.isFinite(port) || port < 1 || port > 65535) return null
			const providerKey =
				url.searchParams.get('provider') ?? url.searchParams.get('p2p') ?? undefined
			return {
				host: hostname,
				port,
				token,
				providerPublicKey: providerKey ?? '',
				...(meshName ? { meshName } : {}),
			}
		} else {
			return {
				providerPublicKey: hostname,
				token,
				...(meshName ? { meshName } : {}),
			}
		}
	} catch {
		return null
	}
}

export function renderPairingHint(p: PairingPayload): string {
	const lines: string[] = []
	lines.push('  ┌────────────────────────────────────────────┐')
	lines.push(`  │  omni://${p.providerPublicKey}`)
	lines.push(`  │  token: ${p.token.slice(0, 16)}…`)
	lines.push('  │')
	lines.push('  │  Scan QR in dashboard, or run:')
	lines.push(`  │    omni join ${p.providerPublicKey} --secret=…`)
	lines.push('  └────────────────────────────────────────────┘')
	return lines.join('\n')
}
