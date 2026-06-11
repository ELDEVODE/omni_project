import path from 'node:path'

export function primeNodePath(): void {
	try {
		const r = Bun.spawnSync({
			cmd: ['npm', 'root', '-g'],
			env: process.env,
			timeout: 3_000,
		})
		if (r.exitCode !== 0) return
		const root = new TextDecoder().decode(r.stdout).trim()
		if (!root) return
		const parent = path.dirname(root)
		const existing = process.env.NODE_PATH ?? ''
		const sep = process.platform === 'win32' ? ';' : ':'
		const parts = existing ? existing.split(sep) : []
		if (!parts.includes(parent)) {
			process.env.NODE_PATH = parts.length
				? `${parts.join(sep)}${sep}${parent}`
				: parent
		}
	} catch {
		// npm not on PATH or spawn failed; the dynamic import will
		// just report the SDK as missing.
	}
}
