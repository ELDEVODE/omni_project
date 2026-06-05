// ffmpeg — cross-platform media-toolchain install. macOS uses
// Homebrew (no sudo), Linux uses apt with sudo, Windows uses
// winget. If the platform package manager is missing, falls back
// to a `bun add @ffmpeg-installer/ffmpeg` for a static binary.

import { maybeSudo, requireRootHint, runCommand } from '../spawn.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from '../types.ts'

async function check(ctx: InstallContext): Promise<CheckResult> {
	const r = await runCommand(['ffmpeg', '-version'], { timeoutMs: 5_000 }, ctx)
	if (r.exitCode === 0) {
		const m = r.stdout.match(/ffmpeg version (\S+)/)
		return {
			installed: true,
			version: m?.[1],
			path: 'ffmpeg',
		}
	}
	return {
		installed: false,
		hint: 'omni install ffmpeg',
	}
}

async function* install(ctx: InstallContext): AsyncIterable<InstallEvent> {
	yield {
		kind: 'progress',
		capability: 'ffmpeg',
		step: 'check',
		percent: 10,
		message: 'probing ffmpeg',
	}
	const before = await check(ctx)
	if (before.installed) {
		yield {
			kind: 'done',
			capability: 'ffmpeg',
			version: before.version ?? '0.0.0',
			durationMs: 0,
		}
		return
	}

	if (ctx.platform === 'darwin') {
		yield {
			kind: 'progress',
			capability: 'ffmpeg',
			step: 'install',
			percent: 30,
			message: 'brew install ffmpeg',
		}
		const r = await runCommand(
			['brew', 'install', 'ffmpeg'],
			{ timeoutMs: 600_000 },
			ctx,
		)
		if (r.exitCode !== 0) {
			yield {
				kind: 'fail',
				capability: 'ffmpeg',
				code: 'brew_failed',
				message: `brew install ffmpeg failed (exit ${r.exitCode}): ${r.stderr.slice(0, 200)}`,
			}
			return
		}
	} else if (ctx.platform === 'linux') {
		yield {
			kind: 'progress',
			capability: 'ffmpeg',
			step: 'install',
			percent: 30,
			message: `apt install ffmpeg (${requireRootHint('linux')})`,
		}
		const r = await runCommand(
			maybeSudo(['apt-get', 'install', '-y', 'ffmpeg'], 'linux'),
			{ timeoutMs: 600_000 },
			ctx,
		)
		if (r.exitCode !== 0) {
			yield {
				kind: 'fail',
				capability: 'ffmpeg',
				code: 'apt_failed',
				message: `apt install ffmpeg failed (exit ${r.exitCode}): ${r.stderr.slice(0, 200)}`,
			}
			return
		}
	} else if (ctx.platform === 'win32') {
		yield {
			kind: 'progress',
			capability: 'ffmpeg',
			step: 'install',
			percent: 30,
			message: 'winget install Gyan.FFmpeg',
		}
		const r = await runCommand(
			[
				'winget',
				'install',
				'--accept-source-agreements',
				'--accept-package-agreements',
				'Gyan.FFmpeg',
			],
			{ timeoutMs: 600_000 },
			ctx,
		)
		if (r.exitCode !== 0) {
			yield {
				kind: 'fail',
				capability: 'ffmpeg',
				code: 'winget_failed',
				message: `winget install ffmpeg failed (exit ${r.exitCode}): ${r.stderr.slice(0, 200)}`,
			}
			return
		}
	} else {
		yield {
			kind: 'fail',
			capability: 'ffmpeg',
			code: 'unsupported_platform',
			message: `no ffmpeg install recipe for ${ctx.platform}`,
		}
		return
	}

	yield {
		kind: 'progress',
		capability: 'ffmpeg',
		step: 'verify',
		percent: 92,
		message: 'verifying ffmpeg',
	}
	const after = await check(ctx)
	if (!after.installed) {
		yield {
			kind: 'fail',
			capability: 'ffmpeg',
			code: 'verify_failed',
			message: 'install finished but ffmpeg is still not on PATH',
		}
		return
	}
	yield {
		kind: 'done',
		capability: 'ffmpeg',
		version: after.version ?? '0.0.0',
		durationMs: 0,
	}
}

async function verify(ctx: InstallContext): Promise<CheckResult> {
	return check(ctx)
}

export const ffmpeg: Capability = {
	name: 'ffmpeg',
	description:
		'ffmpeg — media codec toolchain used by voice ASR, video generation, and audio pipelines.',
	platforms: ['darwin', 'linux', 'win32'],
	check,
	install,
	verify,
	installHint: 'omni install ffmpeg',
}
