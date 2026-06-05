import { spawn } from 'node:child_process'
import type { Command } from '../router.ts'
import { getSecretPath, loadOrCreateSecret } from '../secret-store.ts'
import { c } from '../ui/banner.ts'

export const hostCommand: Command = {
	name: 'host',
	description: 'Start the OmniMesh host — QVAC provider + OpenAI-compat server + dashboard.',
	usage:
		'host [--port=3005] [--name=studio] [--openai-port=11434] [--no-browser]',
	run: ({ flags }) => {
		const port = (flags.port as string) ?? '3005'
		const name = (flags.name as string) ?? 'studio'
		const noBrowser = 'no-browser' in flags
		const secret = loadOrCreateSecret()
		console.log(
			`${c.cyan}→${c.reset} Starting OmniMesh host on port ${port} as "${name}"...`,
		)
		console.log(`${c.dim}   secret: stored at ${getSecretPath()}${c.reset}`)

		const child = spawn('bun', ['run', '--cwd', 'packages/host', 'src/index.ts'], {
			stdio: 'inherit',
			env: {
				...process.env,
				OMNI_PORT: port,
				OMNI_MESH_NAME: name,
				OMNI_NO_BROWSER: noBrowser ? '1' : '',
				OMNI_SECRET: secret,
				OMNI_OPENAI_PORT: '11434',
			},
		})
		return new Promise<number>((resolve) => {
			child.on('exit', (code) => resolve(code ?? 0))
		})
	},
}