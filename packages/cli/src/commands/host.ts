import { spawn } from 'node:child_process'
import type { Command } from '../router.ts'
import { getSecretPath, loadOrCreateSecret } from '../secret-store.ts'
import { c } from '../ui/banner.ts'
import { multiStep } from '../ui/progress.ts'

// Indices of the boot stepper steps. Keeping them as constants makes the
// boot-line handler below easier to read.
const STEP_QVAC = 0
const STEP_OPENAI = 1
const STEP_DASHBOARD = 2

const BOOT_STEPS = [
	{ label: 'starting QVAC provider…' },
	{ label: 'starting OpenAI-compat server…' },
	{ label: 'starting dashboard…' },
]

export const hostCommand: Command = {
	name: 'host',
	description:
		'Start the OmniMesh host — QVAC provider + OpenAI-compat server + dashboard.',
	usage:
		'host [--port=3005] [--name=studio] [--openai-port=11434] [--no-browser]',
	run: ({ flags }) => {
		const port = (flags.port as string) ?? '3005'
		const name = (flags.name as string) ?? 'studio'
		const noBrowser = 'no-browser' in flags
		const verbose = 'verbose' in flags
		const secret = loadOrCreateSecret()
		console.log(
			`${c.cyan}→${c.reset} Starting OmniMesh host on port ${port} as "${name}"...`,
		)
		console.log(`${c.dim}   secret: stored at ${getSecretPath()}${c.reset}`)

		const child = spawn(
			'bun',
			['run', '--cwd', 'packages/host', 'src/index.ts'],
			{
				stdio: ['inherit', 'pipe', 'pipe'],
				env: {
					...process.env,
					OMNI_PORT: port,
					OMNI_MESH_NAME: name,
					OMNI_NO_BROWSER: noBrowser ? '1' : '',
					OMNI_SECRET: secret,
					OMNI_OPENAI_PORT: '11434',
				},
			},
		)

		const stepper = multiStep(BOOT_STEPS)

		// The host child writes structured boot lines on stderr in the form
		// `[boot] <phase>: <message>`. We parse each line and advance the
		// stepper. The first time we see a phase, we activate it; the second
		// time, we complete it (the host emits twice — once on start, once
		// when the phase finishes).
		const seenPhase = { qvac: 0, openai: 0, dashboard: 0 }
		const handleLine = (line: string) => {
			if (verbose) {
				process.stderr.write(`  ${c.dim}${line}${c.reset}\n`)
			}
			const m = line.match(/^\[boot\] (qvac|openai|dashboard):\s*(.+)$/)
			if (!m) return
			const phase = m[1] as 'qvac' | 'openai' | 'dashboard'
			const message = m[2] ?? ''
			const idx =
				phase === 'qvac'
					? STEP_QVAC
					: phase === 'openai'
						? STEP_OPENAI
						: STEP_DASHBOARD
			const count = seenPhase[phase] + 1
			seenPhase[phase] = count
			if (count === 1) {
				stepper.activate(idx, message)
			} else {
				stepper.complete(idx, message)
			}
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
				// Boot lines actually go to stderr in the host, but we
				// forward stdout too in case future versions flip that.
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
				// Flush any partial buffered lines.
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
