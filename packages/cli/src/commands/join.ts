import { spawn } from 'node:child_process'
import { decodePairing } from '../pairing.ts'
import type { Command } from '../router.ts'
import { c } from '../ui/banner.ts'

export const joinCommand: Command = {
	name: 'join',
	description:
		'Join an existing OmniMesh mesh as a QVAC consumer delegating to a provider.',
	usage:
		'join <providerPublicKey|omni://…> [--name=jeffs-mac] [--always-on-voice] [--secret=abc123]',
	run: ({ args, flags }) => {
		const raw = args[0]
		if (!raw) {
			console.error(
				`${c.red}✗${c.reset} provider public key required: omni join <pubkey|omni://…>`,
			)
			return 1
		}
		const name = (flags.name as string) ?? undefined
		const alwaysOnVoice = 'always-on-voice' in flags
		const flagSecret = (flags.secret as string) ?? process.env.OMNI_SECRET
		let providerPublicKey: string
		let secret: string | undefined = flagSecret

		if (raw.startsWith('omni://')) {
			const pairing = decodePairing(raw)
			if (!pairing) {
				console.error(`${c.red}✗${c.reset} invalid omni:// URI: ${raw}`)
				return 1
			}
			providerPublicKey = pairing.providerPublicKey
			secret = pairing.token
			console.log(
				`${c.cyan}→${c.reset} Parsed pairing: ${c.bold}${pairing.meshName ?? 'mesh'}${c.reset} @ ${providerPublicKey.slice(0, 16)}…`,
			)
		} else {
			providerPublicKey = raw
			if (flagSecret) {
				console.log(
					`${c.cyan}→${c.reset} Joining mesh via provider ${providerPublicKey.slice(0, 16)}… with shared secret...`,
				)
			} else {
				console.log(
					`${c.yellow}⚠${c.reset} No secret provided. Pass --secret=<token> or use omni:// URI. (Mesh may reject the connection.)`,
				)
				console.log(
					`${c.cyan}→${c.reset} Joining mesh via provider ${providerPublicKey.slice(0, 16)}… as "${name ?? 'unnamed'}"...`,
				)
			}
		}

		const child = spawn(
			'bun',
			['run', '--cwd', 'packages/host', 'src/join-consumer.ts'],
			{
				stdio: 'inherit',
				env: {
					...process.env,
					OMNI_PROVIDER_PUBLIC_KEY: providerPublicKey,
					...(name ? { OMNI_NODE_NAME: name } : {}),
					...(alwaysOnVoice ? { OMNI_ALWAYS_ON_VOICE: '1' } : {}),
					...(secret ? { OMNI_SECRET: secret } : {}),
				},
			},
		)
		return new Promise<number>((resolve) => {
			child.on('exit', (code) => resolve(code ?? 0))
		})
	},
}
