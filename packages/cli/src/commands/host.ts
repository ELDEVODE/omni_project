import { startHost } from '@omnimesh/host'
import type { Command } from '../router.ts'
import { getSecretPath, loadOrCreateSecret } from '../secret-store.ts'
import { c } from '../ui/banner.ts'

export const hostCommand: Command = {
	name: 'host',
	description:
		'Start the OmniMesh host — QVAC provider + OpenAI-compat server + dashboard.',
	usage: 'host [--port=3005] [--name=studio] [--openai-port=11434]',
	run: ({ flags }) => {
		const port = flags.port !== undefined ? Number(flags.port) : 3005
		const name = (flags.name as string) ?? 'studio'
		const openaiPort =
			flags['openai-port'] !== undefined ? Number(flags['openai-port']) : 11434
		const secret = loadOrCreateSecret()
		console.log(
			`${c.cyan}→${c.reset} Starting OmniMesh host on port ${port} as "${name}"...`,
		)
		console.log(`${c.dim}   secret: stored at ${getSecretPath()}${c.reset}`)

		return startHost({
			port,
			meshName: name,
			openaiPort,
			secret: secret ?? null,
		})
			.then(() => 0)
			.catch((err: Error) => {
				console.error(`${c.red}✗${c.reset} Host failed: ${err.message}`)
				return 1
			})
	},
}
