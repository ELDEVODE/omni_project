// omni install — install a capability on this machine (default) or
// on a peer reachable through the host. The same registry backs
// `omni doctor`, so the install path is one cohesive surface.

import { InstallRunner, defaultRegistry } from '@omnimesh/installer'
import type {
	InstallContext,
	InstallEvent,
	InstallPlatform,
} from '@omnimesh/installer'
import type { Command } from '../router.ts'
import { c } from '../ui/banner.ts'

function resolvePlatform(): InstallPlatform {
	const p = process.platform
	if (p === 'darwin' || p === 'linux' || p === 'win32') return p
	throw new Error(`unsupported platform: ${p}`)
}

function colorEvent(ev: InstallEvent): string {
	if (ev.kind === 'start')
		return `${c.cyan}→${c.reset} start ${ev.capability} (${ev.platform})`
	if (ev.kind === 'progress') {
		const pct = `${ev.percent.toString().padStart(3)}%`
		return `  ${c.dim}${pct}${c.reset} ${ev.message}`
	}
	if (ev.kind === 'done')
		return `${c.green}✓${c.reset} ${ev.capability} ${ev.version} (${ev.durationMs}ms)`
	if (ev.kind === 'fail')
		return `${c.red}✗${c.reset} ${ev.capability}: ${ev.message}`
	if (ev.kind === 'cancel')
		return `${c.yellow}!${c.reset} ${ev.capability} cancelled`
	return `  ${c.dim}${ev.message}${c.reset}`
}

async function runLocal(
	capability: string,
	flags: Record<string, string | boolean>,
): Promise<number> {
	const reg = defaultRegistry
	const cap = reg.get(capability)
	if (!cap) {
		console.error(`${c.red}✗${c.reset} unknown capability: ${capability}`)
		console.error(
			`${c.dim}  run ${c.reset}omni install --list${c.dim} to see available capabilities${c.reset}`,
		)
		return 1
	}
	const dryRun = Boolean(flags['dry-run'])
	const yes = Boolean(flags.yes)
	const noRestart = Boolean(flags['no-restart'])
	const ctx: InstallContext = {
		platform: resolvePlatform(),
		cwd: process.cwd(),
		dryRun,
		yes,
	}
	const runner = new InstallRunner(reg)
	const state = runner.enqueue(capability, ctx)
	if (!yes) {
		console.log(
			`${c.cyan}→${c.reset} ready to install ${c.bold}${capability}${c.reset} via ${cap.installHint}`,
		)
		console.log(
			`  ${c.dim}platform=${ctx.platform} dryRun=${ctx.dryRun} cwd=${ctx.cwd}${c.reset}`,
		)
		console.log(`${c.dim}  pass --yes to skip this prompt${c.reset}`)
	}
	let lastEvent: InstallEvent | undefined
	runner.listen((s, ev) => {
		if (s.installId !== state.installId) return
		lastEvent = ev
		if (flags.quiet && (ev.kind === 'progress' || ev.kind === 'log')) return
		console.log(colorEvent(ev))
	})
	const deadline = Date.now() + 30 * 60_000
	while (state.status === 'queued' || state.status === 'running') {
		if (Date.now() > deadline) {
			console.error(`${c.red}✗${c.reset} install timed out after 30 minutes`)
			return 124
		}
		await new Promise((r) => setTimeout(r, 100))
	}
	if (state.status === 'done') {
		if (cap.requiresRestart && !noRestart) {
			console.log(
				`${c.yellow}!${c.reset} ${capability} requires a host/worker restart to take effect`,
			)
			console.log(
				`  ${c.dim}restart with: ${c.reset}omni host${c.dim} / ${c.reset}omni join${c.dim} (or use --no-restart to suppress this hint)${c.reset}`,
			)
		}
		return 0
	}
	if (state.status === 'cancel') return 130
	if (state.status === 'fail') {
		console.error(`${c.red}✗${c.reset} ${state.error ?? 'install failed'}`)
		if (lastEvent && lastEvent.kind === 'fail') {
			console.error(`  ${c.dim}code: ${lastEvent.code}${c.reset}`)
		}
		return 1
	}
	return 1
}

function listCapabilities(): number {
	const reg = defaultRegistry
	console.log(`${c.cyan}→${c.reset} installable capabilities:\n`)
	let width = 0
	for (const c of reg.list()) width = Math.max(width, c.name.length)
	for (const cap of reg.list()) {
		console.log(
			`  ${c.cyan}${cap.name.padEnd(width)}${c.reset}  ${cap.description}`,
		)
		console.log(
			`  ${' '.repeat(width)}  ${c.dim}platforms: ${cap.platforms.join(', ')}${c.reset}`,
		)
		console.log(
			`  ${' '.repeat(width)}  ${c.dim}install:   ${cap.installHint}${c.reset}`,
		)
	}
	console.log(
		`\n${c.dim}Run ${c.reset}omni install <name>${c.dim} to install locally.${c.reset}`,
	)
	console.log(
		`${c.dim}Use ${c.reset}--target <nodeId>${c.dim} (via --host/--token) to dispatch to a peer.${c.reset}`,
	)
	return 0
}

export const installCommand: Command = {
	name: 'install',
	description:
		'Install a capability (qvac, ffmpeg, vulkan, openwakeword, bonjour) on this machine or a peer.',
	usage:
		'install <capability|--list> [--target=<nodeId>] [--host=<url>] [--token=<bearer>] [--dry-run] [--yes] [--no-restart] [--quiet]',
	run: async ({ args, flags }) => {
		if (flags.list || args.length === 0) return listCapabilities()
		if (args.length > 1) {
			console.error(`${c.red}✗${c.reset} expected exactly one capability name`)
			return 2
		}
		const target = flags.target as string | undefined
		if (target) {
			console.error(
				`${c.yellow}!${c.reset} --target dispatch goes through the host's /api/installs endpoint (lands in 9.4)`,
			)
			console.error(
				`  ${c.dim}use ${c.reset}omni install ${args[0]}${c.dim} to install locally for now.${c.reset}`,
			)
			return 2
		}
		return runLocal(args[0] as string, flags)
	},
}
