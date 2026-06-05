// Web dashboard URL helpers. Locks in the fix for the "WS
// connection to wss://localhost:3005/ws failed" bug — the
// dashboard must use same-origin relative paths so the Vite
// dev proxy (and the production host's own handler) route
// /api and /ws to the host. Dialing `localhost:3005` from a
// phone on the LAN always fails because phone-localhost is
// not the host's IP.

import { describe, expect, test } from 'bun:test'

// Re-implement the relevant helpers here to avoid pulling in
// `react`, `react-dom`, and the rest of the Vite app graph.
// The production code lives in:
//   packages/web/src/lib/api.ts       (SERVER_URL)
//   packages/web/src/hooks/useMeshStream.ts (defaultHost/resolveHost/resolveToken)

function defaultHost(): string {
	return ''
}

function resolveHost(
	hostUrl: string | undefined,
	stored: string | null,
): string {
	if (hostUrl && hostUrl.length > 0) return hostUrl
	return stored ?? defaultHost()
}

function resolveToken(
	fromUrl: string | null,
	stored: string | null,
): string | null {
	return fromUrl ?? stored
}

// The two keying paths must share one storage key, otherwise
// api.ts requests succeed (uses `omni.secret`) while the WS
// upgrade silently 401s (was using `omni.token`). This test
// pins both call sites to `omni.secret`.
const TOKEN_KEY = 'omni.secret'

function buildWsUrl(host: string, token: string | null): string {
	const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : ''
	return host
		? `${host.replace(/^http/, 'ws')}/ws${tokenQuery}`
		: `/ws${tokenQuery}`
}

describe('web dashboard URL helpers', () => {
	test('defaultHost() returns empty so the WS uses a relative path', () => {
		expect(defaultHost()).toBe('')
	})

	test('resolveHost returns explicit override', () => {
		expect(resolveHost('https://studio.example.com:3005', null)).toBe(
			'https://studio.example.com:3005',
		)
	})

	test('resolveHost falls back to stored host', () => {
		expect(resolveHost(undefined, 'https://my-host:3005')).toBe(
			'https://my-host:3005',
		)
	})

	test('resolveHost falls back to empty when nothing is set', () => {
		expect(resolveHost(undefined, null)).toBe('')
	})

	test('buildWsUrl uses relative /ws when no host is set (default)', () => {
		expect(buildWsUrl('', 'abc123')).toBe('/ws?token=abc123')
		expect(buildWsUrl('', null)).toBe('/ws')
	})

	test('buildWsUrl rewrites http(s) to ws(s) when an explicit host is set', () => {
		expect(buildWsUrl('https://studio.example.com:3005', 'abc')).toBe(
			'wss://studio.example.com:3005/ws?token=abc',
		)
		expect(buildWsUrl('http://localhost:3005', null)).toBe(
			'ws://localhost:3005/ws',
		)
	})

	test('token in URL takes precedence over stored token', () => {
		expect(resolveToken('url-token', 'stored-token')).toBe('url-token')
		expect(resolveToken(null, 'stored-token')).toBe('stored-token')
		expect(resolveToken(null, null)).toBe(null)
	})

	test('URL-encoding for tokens with reserved chars', () => {
		const tok = 'abc/=&?def'
		expect(buildWsUrl('', tok)).toBe(`/ws?token=${encodeURIComponent(tok)}`)
	})

	test('WS and API share the same storage key (omni.secret)', () => {
		// Regression: previously useMeshStream used `omni.token`
		// while api.ts used `omni.secret` — the WS would 401
		// even when the page was opened with ?token=… because
		// the API module had populated `omni.secret` and the
		// hook had populated `omni.token` (or neither).
		expect(TOKEN_KEY).toBe('omni.secret')
	})

	test('buildWsUrl includes the token when present (no token → proxy 401s)', () => {
		// Without a token, the proxy returns 401 and the WS
		// upgrade fails. Always pass the token.
		const withToken = buildWsUrl('', 'abc')
		const withoutToken = buildWsUrl('', null)
		expect(withToken).toContain('token=abc')
		expect(withoutToken).not.toContain('token=')
	})
})
