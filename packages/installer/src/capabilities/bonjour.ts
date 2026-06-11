// bonjour — mDNS service discovery. The host package already
// depends on `bonjour-service`, but the install capability is
// exposed so other packages (e.g. a future standalone worker
// build) can pull it in. Check verifies `require.resolve`,
// install runs `bun add bonjour-service` in the requested package
// directory.

import { existsSync } from 'node:fs'
import path from 'node:path'
import { runCommand } from '../spawn.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from '../types.ts'

function tryResolve(): { installed: boolean; version?: string; path?: string } {
	try {
		const fs = require('node:fs') as typeof import('node:fs')
		const { createRequire } = require('node:module') as typeof import('node:module')
		const req = createRequire(process.cwd() + '/')
		const resolved = req.resolve('bonjour-service/package.json')
		const pkg = JSON.parse(fs.readFileSync(resolved, 'utf8')) as { version?: string }
		return { installed: true, version: pkg.version, path: resolved }
	} catch {
		return { installed: false }
	}
}

async function check(_ctx: InstallContext): Promise<CheckResult> {
	const r = tryResolve()
	if (r.installed) return { installed: true, version: r.version, path: r.path }
	return { installed: false, hint: 'omni install bonjour' }
}

async function verify(ctx: InstallContext): Promise<CheckResult> {
	return check(ctx)
}

async function* install(ctx: InstallContext): AsyncIterable<InstallEvent> {
	yield {
		kind: 'progress',
		capability: 'bonjour',
		step: 'check',
		percent: 10,
		message: 'probing bonjour-service',
	}
	const before = await check(ctx)
	if (before.installed) {
		yield {
			kind: 'done',
			capability: 'bonjour',
			version: before.version ?? '0.0.0',
			durationMs: 0,
		}
		return
	}

	const target = ctx.cwd
	if (!existsSync(path.join(target, 'package.json'))) {
		yield {
			kind: 'fail',
			capability: 'bonjour',
			code: 'target_missing',
			message: `No package.json found in ${target}. Run this inside an OmniMesh package.`,
		}
		return
	}

	yield {
		kind: 'progress',
		capability: 'bonjour',
		step: 'install',
		percent: 50,
		message: 'bun add bonjour-service',
	}
	const r = await runCommand(
		['bun', 'add', 'bonjour-service'],
		{ cwd: target, timeoutMs: 300_000 },
		ctx,
	)
	if (r.exitCode !== 0) {
		yield {
			kind: 'fail',
			capability: 'bonjour',
			code: 'bun_add_failed',
			message: `bun add bonjour-service failed (exit ${r.exitCode}): ${r.stderr.slice(0, 200)}`,
		}
		return
	}

	const after = await check(ctx)
	if (!after.installed) {
		yield {
			kind: 'fail',
			capability: 'bonjour',
			code: 'verify_failed',
			message: 'install finished but bonjour-service is still not resolvable',
		}
		return
	}
	yield {
		kind: 'done',
		capability: 'bonjour',
		version: after.version ?? '0.0.0',
		durationMs: 0,
	}
}

export const bonjour: Capability = {
	name: 'bonjour',
	description:
		'bonjour-service — mDNS service discovery used by `omni host` to advertise on the LAN.',
	platforms: ['darwin', 'linux', 'win32'],
	check,
	install,
	verify,
	installHint: 'omni install bonjour',
}
