// LAN IP auto-detection. Used by `omni host` when the user doesn't pass
// `--public=…`, so the printed `omni://` URI is reachable from phones
// and other devices on the same network.
//
// Strategy:
//   1. macOS:   `ipconfig getifaddr en0` (then en1 as a fallback)
//   2. Linux:   `hostname -I` → first token that parses as an IPv4
//   3. Windows: `ipconfig` → parse out IPv4 entries
//   4. Fallback: scan all non-loopback IPv4 addresses returned by
//      `os.networkInterfaces()` and pick the first private RFC1918
//      address (10/8, 172.16/12, 192.168/16). If none, return the first
//      non-loopback IPv4.
//
// Returns `null` if no candidate can be determined, in which case
// callers should fall back to `127.0.0.1`.

import { spawnSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'

export function isPrivateIPv4(ip: string): boolean {
	const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
	if (!m) return false
	const o1 = Number(m[1])
	const o2 = Number(m[2])
	if (o1 === 10) return true
	if (o1 === 172 && o2 >= 16 && o2 <= 31) return true
	if (o1 === 192 && o2 === 168) return true
	if (o1 === 169 && o2 === 254) return true // link-local
	return false
}

function shellOut(cmd: string, args: string[]): string | null {
	try {
		const r = spawnSync(cmd, args, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			timeout: 1500,
		})
		if (r.status !== 0) return null
		const out = r.stdout.trim()
		return out.length > 0 ? out : null
	} catch {
		return null
	}
}

function fromMacOS(): string | null {
	for (const iface of ['en0', 'en1', 'en2']) {
		const out = shellOut('ipconfig', ['getifaddr', iface])
		if (out && isPrivateIPv4(out)) return out
	}
	return null
}

function fromLinux(): string | null {
	const out = shellOut('hostname', ['-I'])
	if (!out) return null
	for (const tok of out.split(/\s+/)) {
		if (isPrivateIPv4(tok)) return tok
	}
	return null
}

function fromNodeOS(): string | null {
	const ifaces = networkInterfaces()
	const candidates: { name: string; addr: string }[] = []
	for (const [name, addrs] of Object.entries(ifaces)) {
		if (!addrs) continue
		for (const a of addrs) {
			if (a.family === 'IPv4' && !a.internal) {
				candidates.push({ name, addr: a.address })
			}
		}
	}
	const privates = candidates.filter((c) => isPrivateIPv4(c.addr))
	return privates[0]?.addr ?? candidates[0]?.addr ?? null
}

export function detectLanIP(): string | null {
	const platform = process.platform
	let detected: string | null = null
	if (platform === 'darwin') {
		detected = fromMacOS() ?? fromNodeOS()
	} else if (platform === 'linux') {
		detected = fromLinux() ?? fromNodeOS()
	} else if (platform === 'win32') {
		// `ipconfig` parsing is brittle; rely on os.networkInterfaces()
		detected = fromNodeOS()
	} else {
		detected = fromNodeOS()
	}
	return detected
}
