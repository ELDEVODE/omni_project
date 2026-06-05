// Encode a payload as an omni:// URI suitable for QR-code generation or copy/paste.
//
// Format: omni://<providerPublicKey>?token=<token>
//
// The providerPublicKey is the QVAC provider's ed25519 public key (hex).
// No port, no host — the Hyperswarm DHT resolves the provider by public key.

export type PairingPayload = {
	providerPublicKey: string
	token: string
	meshName?: string
}

export function encodePairing(p: PairingPayload): string {
	const params = new URLSearchParams()
	params.set('token', p.token)
	if (p.meshName) params.set('mesh', p.meshName)
	const query = params.toString()
	return `omni://${p.providerPublicKey}${query ? `?${query}` : ''}`
}

export function decodePairing(uri: string): PairingPayload | null {
	if (!uri.startsWith('omni://')) return null
	try {
		const url = new URL(uri.replace('omni://', 'http://'))
		const providerPublicKey = url.hostname
		const token = url.searchParams.get('token')
		if (!providerPublicKey || !token) return null
		const meshName = url.searchParams.get('mesh') ?? undefined
		return { providerPublicKey, token, ...(meshName ? { meshName } : {}) }
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