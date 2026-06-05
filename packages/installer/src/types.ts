// Public types for the OmniMesh installer. The capability registry,
// the serial runner, and any node-side dispatcher all share these
// shapes. Keep this file dependency-free so it can be imported from
// the CLI, the host, the worker, and the dashboard bridge.

export type InstallPlatform = 'darwin' | 'linux' | 'win32'

export type InstallStep = 'check' | 'install' | 'verify' | 'post'

export type CheckResult = {
	installed: boolean
	version?: string
	path?: string
	hint?: string
}

export type InstallEvent =
	| { kind: 'start'; capability: string; platform: InstallPlatform }
	| {
			kind: 'progress'
			capability: string
			step: InstallStep
			percent: number
			message: string
	  }
	| { kind: 'done'; capability: string; version: string; durationMs: number }
	| { kind: 'fail'; capability: string; code: string; message: string }
	| { kind: 'cancel'; capability: string }
	| {
			kind: 'log'
			capability: string
			level: 'debug' | 'info' | 'warn' | 'error'
			message: string
	  }

export type InstallContext = {
	platform: InstallPlatform
	cwd: string
	dryRun: boolean
	yes: boolean
	onEvent?: (e: InstallEvent) => void
	abortSignal?: AbortSignal
}

export interface Capability {
	name: string
	description: string
	platforms: InstallPlatform[]
	check(ctx: InstallContext): Promise<CheckResult>
	install(ctx: InstallContext): AsyncIterable<InstallEvent>
	verify(ctx: InstallContext): Promise<CheckResult>
	installHint: string
	requiresRestart?: boolean
}

export function isInstallPlatform(value: string): value is InstallPlatform {
	return value === 'darwin' || value === 'linux' || value === 'win32'
}

export function detectPlatform(): InstallPlatform {
	const p = process.platform
	if (isInstallPlatform(p)) return p
	throw new Error(`unsupported platform for installer: ${p}`)
}
