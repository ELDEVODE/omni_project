// qvac — installs the @qvac/sdk npm package globally so the
// compiled `omni` binary can dynamic-import it. The capability is
// designed for end users running the standalone binary (no source
// tree available); for source-tree dev checkouts the same code
// still works because npm-install of an existing package is a
// no-op fast path.
//
// After install, host/join must be restarted so the dynamic
// `import('@qvac/sdk')` picks up the newly installed module —
// signaled via `requiresRestart: true`.

import path from 'node:path'
import { maybeSudo, runCommand } from '../spawn.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from '../types.ts'

const PACKAGE = '@qvac/sdk'

function globalNodeModulesRoot(ctx: InstallContext): string | null {
	// `npm root -g` prints the global node_modules directory. Run it
	// without elevation; npm itself owns the path. If it fails, we
	// fall back to the well-known per-platform paths.
	try {
		// Synchronous best-effort: most platforms expose npm on PATH
		// for the same user that's running omni. We use Bun.spawnSync
		// here so the resolver can stay sync (it must — the verify
		// step is called from a sync `check()` in some code paths).
		const r = Bun.spawnSync({
			cmd: ['npm', 'root', '-g'],
			env: process.env,
		})
		if (r.exitCode === 0) {
			const out = new TextDecoder().decode(r.stdout).trim()
			if (out) return out
		}
	} catch {
		// npm not on PATH or Bun.spawnSync failed — fall through.
	}
	// Platform fallbacks. These are best-effort; if neither exists
	// the resolver will report "not installed" and the user can
	// re-run `omni install qvac` once they've installed Node.
	if (ctx.platform === 'win32') {
		const appData = process.env.APPDATA
		if (appData) return path.join(appData, 'npm', 'node_modules')
		return null
	}
	if (ctx.platform === 'darwin') {
		return '/usr/local/lib/node_modules'
	}
	return '/usr/lib/node_modules'
}

function tryResolve(ctx: InstallContext): {
	installed: boolean
	version?: string
	path?: string
} {
	const roots: string[] = []
	const globalRoot = globalNodeModulesRoot(ctx)
	if (globalRoot) roots.push(globalRoot)
	roots.push(ctx.cwd) // dev-tree fallback
	roots.push(process.cwd())
	try {
		const resolved = require.resolve(`${PACKAGE}/package.json`, {
			paths: roots,
		})
		// Find the closest package.json in the resolution chain.
		const pkg = require(`${PACKAGE}/package.json`) as { version?: string }
		return { installed: true, version: pkg.version, path: resolved }
	} catch {
		return { installed: false }
	}
}

async function check(ctx: InstallContext): Promise<CheckResult> {
	const r = tryResolve(ctx)
	if (r.installed) {
		return { installed: true, version: r.version, path: r.path }
	}
	return { installed: false, hint: 'omni install qvac' }
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

	// Pre-flight: ensure `npm` is on PATH. Without it we can't install
	// or verify, and we want to fail fast with a clear message.
	const npmProbe = await runCommand(
		['npm', '--version'],
		{ timeoutMs: 5_000 },
		ctx,
	)
	if (npmProbe.exitCode !== 0) {
		yield {
			kind: 'fail',
			capability: 'qvac',
			code: 'npm_missing',
			message: `npm is required to install ${PACKAGE} but was not found on PATH. Install Node.js (https://nodejs.org) and re-run \`omni install qvac\`.`,
		}
		return
	}

	yield {
		kind: 'progress',
		capability: 'qvac',
		step: 'install',
		percent: 15,
		message: before.installed
			? `updating ${PACKAGE} (have ${before.version ?? 'unknown'})`
			: `installing ${PACKAGE} (npm install -g ${PACKAGE})`,
	}

	// Use `npm install -g @qvac/sdk` so the dynamic import in the
	// compiled binary can find it via the global node_modules path.
	// On Linux, elevate with sudo if we're not already root.
	const cmd =
		ctx.platform === 'linux'
			? maybeSudo(['npm', 'install', '-g', PACKAGE], 'linux')
			: ['npm', 'install', '-g', PACKAGE]

	const r = await runCommand(cmd, { timeoutMs: 600_000 }, ctx)
	if (r.exitCode !== 0) {
		yield {
			kind: 'progress',
			capability: 'qvac',
			step: 'install',
			percent: 85,
			message: `npm install failed (exit ${r.exitCode})`,
		}
		yield {
			kind: 'fail',
			capability: 'qvac',
			code: 'npm_install_failed',
			message: `npm install -g ${PACKAGE} failed (exit ${r.exitCode}): ${r.stderr.slice(0, 240)}`,
		}
		return
	}

	yield {
		kind: 'progress',
		capability: 'qvac',
		step: 'verify',
		percent: 92,
		message: `verifying ${PACKAGE} resolvable from global modules`,
	}
	const after = await check(ctx)
	if (!after.installed) {
		yield {
			kind: 'fail',
			capability: 'qvac',
			code: 'verify_failed',
			message: `install succeeded but ${PACKAGE} is still not resolvable. Try running \`npm install -g ${PACKAGE}\` manually to see the underlying error.`,
		}
		return
	}

	// Touch the cache marker so doctor / CapsReport sees the bump.
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
