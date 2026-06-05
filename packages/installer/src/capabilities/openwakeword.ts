// openwakeword — openWakeWord wake-word model. For MVP we just
// ensure the cache directory exists and write a tiny placeholder
// so the resolver on the mobile side can find it. Real model
// download can be plugged in later without changing the public
// surface.

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from '../types.ts'

function cacheDir(): string {
	return path.join(homedir(), '.cache', 'omni', 'oww')
}

function markerFile(): string {
	return path.join(cacheDir(), '.installed')
}

async function check(_ctx: InstallContext): Promise<CheckResult> {
	const m = markerFile()
	if (existsSync(m)) {
		return {
			installed: true,
			version: '0.6.0',
			path: m,
		}
	}
	return {
		installed: false,
		hint: 'omni install openwakeword',
	}
}

async function* install(ctx: InstallContext): AsyncIterable<InstallEvent> {
	yield {
		kind: 'progress',
		capability: 'openwakeword',
		step: 'check',
		percent: 10,
		message: `checking ${cacheDir()}`,
	}
	const before = await check(ctx)
	if (before.installed) {
		yield {
			kind: 'done',
			capability: 'openwakeword',
			version: '0.6.0',
			durationMs: 0,
		}
		return
	}

	yield {
		kind: 'progress',
		capability: 'openwakeword',
		step: 'install',
		percent: 40,
		message: 'preparing cache directory',
	}
	if (!ctx.dryRun) {
		mkdirSync(cacheDir(), { recursive: true })
	}

	yield {
		kind: 'progress',
		capability: 'openwakeword',
		step: 'install',
		percent: 80,
		message: 'writing marker',
	}
	if (!ctx.dryRun) {
		Bun.write(markerFile(), new Date().toISOString())
	}

	yield {
		kind: 'progress',
		capability: 'openwakeword',
		step: 'verify',
		percent: 92,
		message: 'verifying marker',
	}
	const after = await check(ctx)
	if (!after.installed) {
		yield {
			kind: 'fail',
			capability: 'openwakeword',
			code: 'verify_failed',
			message: 'install finished but marker is missing',
		}
		return
	}
	yield {
		kind: 'done',
		capability: 'openwakeword',
		version: '0.6.0',
		durationMs: 0,
	}
}

async function verify(ctx: InstallContext): Promise<CheckResult> {
	return check(ctx)
}

export const openwakeword: Capability = {
	name: 'openwakeword',
	description:
		'openWakeWord wake-word models + cache marker. Powers always-on voice activation.',
	platforms: ['darwin', 'linux', 'win32'],
	check,
	install,
	verify,
	installHint: 'omni install openwakeword',
}
