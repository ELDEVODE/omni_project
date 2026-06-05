import type { Command } from '../router.ts'
import { loadAuthToken } from '../secret-store.ts'
import { c } from '../ui/banner.ts'

export const rotateSecretCommand: Command = {
	name: 'rotate-secret',
	description:
		'Generate a new pairing secret on the host, invalidating existing sessions.',
	usage: 'rotate-secret [--host=http://localhost:3005]',
	run: async ({ flags }) => {
		const host = (flags.host as string) ?? 'http://127.0.0.1:3005'
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		const token = loadAuthToken()
		if (token) headers.Authorization = `Bearer ${token}`
		try {
			const res = await fetch(`${host}/api/admin/rotate-secret`, {
				method: 'POST',
				headers,
			})
			if (!res.ok) {
				// eslint-disable-next-line no-console
				console.error(`${c.red}✗${c.reset} HTTP ${res.status}`)
				return 1
			}
			const data = (await res.json()) as { ok: boolean; secret: string }
			// eslint-disable-next-line no-console
			console.log(
				`${c.green}✓${c.reset} secret rotated. New token: ${c.cyan}${data.secret}${c.reset}`,
			)
			// eslint-disable-next-line no-console
			console.log(
				`${c.dim}  Existing peers must reconnect with the new token.${c.reset}`,
			)
			return 0
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error(`${c.red}✗${c.reset} ${(err as Error).message}`)
			return 1
		}
	},
}
