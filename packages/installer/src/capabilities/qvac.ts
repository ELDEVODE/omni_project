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

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { maybeSudo, runCommand } from '../spawn.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from '../types.ts'

const PACKAGE = '@qvac/sdk'
const CLI_PACKAGE = '@qvac/cli'

function globalNodeModulesRoot(ctx: InstallContext): string | null {
	// `npm root -g` prints the global node_modules directory. Run it
	// without elevation; npm itself owns the path. If it fails, we
	// fall back to the well-known per-platform paths.
	try {
		// Synchronous best-effort: most platforms expose npm on PATH
		// for the same user that's running omni. We use Bun.spawnSync
		// here so the resolver can stay sync (it must — the verify
		// step is called from a sync `check()` in some code paths).
		// The timeout is critical: in bun --compile binaries,
		// Bun.spawnSync without a timeout can hang indefinitely
		// when the host shell is a non-interactive PTY in some
		// configurations. 3s is plenty for a `npm root -g` call.
		const npmProbeCmd =
			ctx.platform === 'win32'
				? ['cmd.exe', '/c', 'npm', 'root', '-g']
				: ['npm', 'root', '-g']
		const r = Bun.spawnSync({
			cmd: npmProbeCmd,
			env: process.env,
			timeout: 3_000,
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
	// Probe the candidate install locations directly instead of
	// using `require.resolve(..., { paths })`. In a bun --compile
	// binary the resolver's base is a virtual /$bunfs/root path and
	// the `paths` option is silently ignored, so we just walk the
	// well-known locations and read the package.json.
	const candidates: string[] = []
	const globalRoot = globalNodeModulesRoot(ctx)
	if (globalRoot) {
		// npm drops the package at <globalRoot>/<name>/package.json.
		candidates.push(path.join(globalRoot, PACKAGE, 'package.json'))
	}
	// Dev-tree fallback: <cwd>/node_modules/@qvac/sdk/package.json.
	candidates.push(path.join(ctx.cwd, 'node_modules', PACKAGE, 'package.json'))
	candidates.push(
		path.join(process.cwd(), 'node_modules', PACKAGE, 'package.json'),
	)
	for (const pkgJson of candidates) {
		if (!existsSync(pkgJson)) continue
		try {
			const pkg = JSON.parse(readFileSync(pkgJson, 'utf8')) as {
				name?: string
				version?: string
			}
			if (pkg.name === PACKAGE) {
				return { installed: true, version: pkg.version, path: pkgJson }
			}
		} catch {
			// unreadable — try the next candidate
		}
	}
	return { installed: false }
}

async function check(ctx: InstallContext): Promise<CheckResult> {
	const r = tryResolve(ctx)
	if (r.installed) {
		return { installed: true, version: r.version, path: r.path }
	}
	return { installed: false, hint: 'omni install qvac' }
}

function npmCmd(ctx: InstallContext, ...args: string[]): string[] {
	// On Windows, npm is npm.cmd — a batch file that cannot be spawned
	// directly by Bun.spawn (or CreateProcess) without cmd.exe.
	return ctx.platform === 'win32'
		? ['cmd.exe', '/c', 'npm', ...args]
		: ['npm', ...args]
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
		npmCmd(ctx, '--version'),
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
			? `updating QVAC (have ${PACKAGE}@${before.version ?? 'unknown'})`
			: `installing QVAC (npm install -g ${PACKAGE} ${CLI_PACKAGE})`,
	}

	// Use `npm install -g @qvac/sdk` so the dynamic import in the
	// compiled binary can find it via the global node_modules path.
	// On Linux, elevate with sudo if we're not already root.
	const cmd =
		ctx.platform === 'linux'
			? maybeSudo(npmCmd(ctx, 'install', '-g', PACKAGE, CLI_PACKAGE), 'linux')
			: npmCmd(ctx, 'install', '-g', PACKAGE, CLI_PACKAGE)

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
			message: `npm install -g ${PACKAGE} ${CLI_PACKAGE} failed (exit ${r.exitCode}): ${r.stderr.slice(0, 240)}`,
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
