// qvac — installs the @qvac/sdk npm package into the workspace's
// host, worker, and (optionally) mobile packages. After install
// the host/worker must restart to pick up the new SDK, which is
// signaled via `requiresRestart: true`.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { runCommand } from '../spawn.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from '../types.ts'

const TARGET_PACKAGES = [
	{ name: '@omnimesh/host', dir: 'packages/host' },
	{ name: '@omnimesh/worker', dir: 'packages/worker' },
]

function tryResolve(): { installed: boolean; version?: string; path?: string } {
	try {
		// Use require.resolve so we get the real on-disk path of the
		// hoisted package. Falls back gracefully if not installed.
		const resolved = require.resolve('@qvac/sdk/package.json', {
			paths: [process.cwd()],
		})
		const pkg = require('@qvac/sdk/package.json') as { version?: string }
		return {
			installed: true,
			version: pkg.version,
			path: resolved,
		}
	} catch {
		return { installed: false }
	}
}

async function check(_ctx: InstallContext): Promise<CheckResult> {
	const r = tryResolve()
	if (r.installed) {
		return { installed: true, version: r.version, path: r.path }
	}
	return {
		installed: false,
		hint: 'omni install qvac',
	}
}

async function* install(ctx: InstallContext): AsyncIterable<InstallEvent> {
	yield {
		kind: 'progress',
		capability: 'qvac',
		step: 'check',
		percent: 5,
		message: 'probing @qvac/sdk',
	}
	const before = await check(ctx)
	yield {
		kind: 'progress',
		capability: 'qvac',
		step: 'install',
		percent: 15,
		message: before.installed
			? `updating @qvac/sdk (have ${before.version ?? 'unknown'})`
			: 'installing @qvac/sdk',
	}

	const total = TARGET_PACKAGES.length
	let i = 0
	for (const pkg of TARGET_PACKAGES) {
		if (ctx.abortSignal?.aborted) {
			yield { kind: 'cancel', capability: 'qvac' }
			return
		}
		const target = path.join(ctx.cwd, pkg.dir)
		if (!existsSync(target)) {
			yield {
				kind: 'log',
				capability: 'qvac',
				level: 'warn',
				message: `skipping ${pkg.name} (${target} not found)`,
			}
			i++
			continue
		}
		const r = await runCommand(
			['bun', 'add', '@qvac/sdk'],
			{ cwd: target, timeoutMs: 600_000 },
			ctx,
		)
		if (r.exitCode !== 0) {
			yield {
				kind: 'fail',
				capability: 'qvac',
				code: 'bun_add_failed',
				message: `bun add @qvac/sdk in ${pkg.name} failed (exit ${r.exitCode}): ${r.stderr.slice(0, 200)}`,
			}
			return
		}
		i++
		yield {
			kind: 'progress',
			capability: 'qvac',
			step: 'install',
			percent: 15 + Math.round((i / total) * 70),
			message: `installed in ${pkg.name}`,
		}
	}

	yield {
		kind: 'progress',
		capability: 'qvac',
		step: 'verify',
		percent: 92,
		message: 'verifying @qvac/sdk resolvable',
	}
	const after = await check(ctx)
	if (!after.installed) {
		yield {
			kind: 'fail',
			capability: 'qvac',
			code: 'verify_failed',
			message: 'install succeeded but @qvac/sdk is still not resolvable',
		}
		return
	}

	// Touch the cache directory so doctor / CapsReport sees the bump.
	const cache = path.join(ctx.cwd, '.qvac-installed')
	if (!ctx.dryRun) {
		try {
			Bun.write(cache, new Date().toISOString())
		} catch {
			// best-effort
		}
	}

	yield {
		kind: 'done',
		capability: 'qvac',
		version: after.version ?? '0.0.0',
		durationMs: 0,
	}
}

async function verify(ctx: InstallContext): Promise<CheckResult> {
	return check(ctx)
}

export const qvac: Capability = {
	name: 'qvac',
	description:
		'@qvac/sdk — P2P inference runtime, distributed model registry, and delegate dispatch.',
	platforms: ['darwin', 'linux', 'win32'],
	check,
	install,
	verify,
	installHint: 'omni install qvac',
	requiresRestart: true,
}
