import { spawn } from 'node:child_process'
import { decodePairing } from '../pairing.ts'
import type { Command } from '../router.ts'
import { c } from '../ui/banner.ts'
import { multiStep } from '../ui/progress.ts'

const STEP_SDK = 0
const STEP_CONNECT = 1
const STEP_READY = 2

const JOIN_STEPS = [
	{ label: 'loading @qvac/sdk…' },
	{ label: 'dialling provider…' },
	{ label: 'consumer online' },
]

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
		const verbose = 'verbose' in flags
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
				stdio: ['inherit', 'pipe', 'pipe'],
				env: {
					...process.env,
					OMNI_PROVIDER_PUBLIC_KEY: providerPublicKey,
					...(name ? { OMNI_NODE_NAME: name } : {}),
					...(alwaysOnVoice ? { OMNI_ALWAYS_ON_VOICE: '1' } : {}),
					...(secret ? { OMNI_SECRET: secret } : {}),
				},
			},
		)

		const stepper = multiStep(JOIN_STEPS)
		const seenPhase = { sdk: 0, connect: 0, ready: 0 }
		const handleLine = (line: string) => {
			if (verbose) process.stderr.write(`  ${c.dim}${line}${c.reset}\n`)
			const m = line.match(/^\[boot\] (sdk|connect|ready):\s*(.+)$/)
			if (!m) return
			const phase = m[1] as 'sdk' | 'connect' | 'ready'
			const message = m[2] ?? ''
			const idx =
				phase === 'sdk'
					? STEP_SDK
					: phase === 'connect'
						? STEP_CONNECT
						: STEP_READY
			const count = seenPhase[phase] + 1
			seenPhase[phase] = count
			if (count === 1) stepper.activate(idx, message)
			else stepper.complete(idx, message)
		}

		let stdoutBuf = ''
		let stderrBuf = ''
		const splitLines = (
			buffer: string,
			chunk: string,
			onLine: (line: string) => void,
		): string => {
			const next = buffer + chunk
			let nl = next.indexOf('\n')
			while (nl >= 0) {
				const line = next.slice(0, nl)
				onLine(line)
				nl = next.indexOf('\n', nl + 1)
			}
			const tail = next.lastIndexOf('\n')
			return tail >= 0 ? next.slice(tail + 1) : next
		}
		child.stdout?.on('data', (chunk) => {
			stdoutBuf = splitLines(stdoutBuf, chunk.toString(), (line) => {
				handleLine(line)
				process.stdout.write(`${line}\n`)
			})
		})
		child.stderr?.on('data', (chunk) => {
			stderrBuf = splitLines(stderrBuf, chunk.toString(), (line) => {
				handleLine(line)
				if (verbose) process.stderr.write(`${line}\n`)
			})
		})

		return new Promise<number>((resolve) => {
			child.on('exit', (code) => {
				if (stdoutBuf.length) {
					process.stdout.write(`${stdoutBuf}\n`)
					stdoutBuf = ''
				}
				if (stderrBuf.length && verbose) {
					process.stderr.write(`${stderrBuf}\n`)
					stderrBuf = ''
				}
				resolve(code ?? 0)
			})
		})
	},
}
