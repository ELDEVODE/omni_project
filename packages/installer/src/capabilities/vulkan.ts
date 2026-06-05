// vulkan — Linux GPU driver + tools. macOS uses Metal (no install
// needed), Windows uses vendor drivers from the GPU maker. On
// Linux we install mesa-vulkan-drivers + vulkan-tools.

import { maybeSudo, runCommand } from '../spawn.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from '../types.ts'

async function check(ctx: InstallContext): Promise<CheckResult> {
	if (ctx.platform !== 'linux') {
		return {
			installed: true,
			version: 'n/a',
			path: 'platform-default',
		}
	}
	const r = await runCommand(
		['vulkaninfo', '--summary'],
		{ timeoutMs: 5_000 },
		ctx,
	)
	if (r.exitCode === 0) {
		const m = r.stdout.match(/Vulkan Instance Version: (\S+)/)
		return {
			installed: true,
			version: m?.[1],
			path: 'vulkaninfo',
		}
	}
	return {
		installed: false,
		hint: 'omni install vulkan',
	}
}

async function* install(ctx: InstallContext): AsyncIterable<InstallEvent> {
	yield {
		kind: 'progress',
		capability: 'vulkan',
		step: 'check',
		percent: 10,
		message: 'probing vulkaninfo',
	}
	const before = await check(ctx)
	if (before.installed) {
		yield {
			kind: 'done',
			capability: 'vulkan',
			version: before.version ?? 'platform-default',
			durationMs: 0,
		}
		return
	}

	if (ctx.platform !== 'linux') {
		yield {
			kind: 'fail',
			capability: 'vulkan',
			code: 'unsupported_platform',
			message: `vulkan is GPU-driver-managed on ${ctx.platform}; install vendor drivers from your GPU maker`,
		}
		return
	}

	yield {
		kind: 'progress',
		capability: 'vulkan',
		step: 'install',
		percent: 30,
		message: 'apt install mesa-vulkan-drivers vulkan-tools',
	}
	const r = await runCommand(
		maybeSudo(
			['apt-get', 'install', '-y', 'mesa-vulkan-drivers', 'vulkan-tools'],
			'linux',
		),
		{ timeoutMs: 600_000 },
		ctx,
	)
	if (r.exitCode !== 0) {
		yield {
			kind: 'fail',
			capability: 'vulkan',
			code: 'apt_failed',
			message: `apt install vulkan failed (exit ${r.exitCode}): ${r.stderr.slice(0, 200)}`,
		}
		return
	}

	yield {
		kind: 'progress',
		capability: 'vulkan',
		step: 'verify',
		percent: 92,
		message: 'verifying vulkaninfo',
	}
	const after = await check(ctx)
	if (!after.installed) {
		yield {
			kind: 'fail',
			capability: 'vulkan',
			code: 'verify_failed',
			message: 'install finished but vulkaninfo is still not on PATH',
		}
		return
	}
	yield {
		kind: 'done',
		capability: 'vulkan',
		version: after.version ?? '0.0.0',
		durationMs: 0,
	}
}

async function verify(ctx: InstallContext): Promise<CheckResult> {
	return check(ctx)
}

export const vulkan: Capability = {
	name: 'vulkan',
	description:
		'Vulkan GPU drivers + vulkaninfo (Linux). On macOS, Metal is used. On Windows, install vendor drivers.',
	platforms: ['darwin', 'linux', 'win32'],
	check,
	install,
	verify,
	installHint: 'omni install vulkan',
}
