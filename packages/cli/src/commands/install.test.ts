// Tests for the `omni install` CLI subcommand. Uses the same
// fake-capability pattern as the installer's runner tests so the
// command is exercised without touching real install recipes.

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Capability, CheckResult, InstallEvent } from '@omnimesh/installer'

const captured: { installId: string; events: string[] }[] = []

function fakeCap(opts: {
	name: string
	failOn?: 'never' | 'progress'
	delayMs?: number
}): Capability {
	const delay = opts.delayMs ?? 5
	return {
		name: opts.name,
		description: `fake ${opts.name}`,
		platforms: ['darwin', 'linux', 'win32'],
		installHint: `omni install ${opts.name}`,
		async check(): Promise<CheckResult> {
			return { installed: false, hint: `omni install ${opts.name}` }
		},
		async *install(): AsyncIterable<InstallEvent> {
			yield {
				kind: 'progress',
				capability: opts.name,
				step: 'install',
				percent: 50,
				message: 'halfway',
			}
			await new Promise((r) => setTimeout(r, delay))
			if (opts.failOn === 'progress') {
				yield {
					kind: 'fail',
					capability: opts.name,
					code: 'fake_fail',
					message: 'simulated',
				}
				return
			}
			yield {
				kind: 'done',
				capability: opts.name,
				version: '1.0.0',
				durationMs: delay,
			}
		},
		async verify(): Promise<CheckResult> {
			return { installed: true, version: '1.0.0' }
		},
	}
}

let originalLog: typeof console.log
let originalErr: typeof console.error
let logs: string[]
let errs: string[]

beforeEach(() => {
	logs = []
	errs = []
	originalLog = console.log
	originalErr = console.error
	console.log = (...a: unknown[]) => {
		logs.push(a.map((x) => String(x)).join(' '))
	}
	console.error = (...a: unknown[]) => {
		errs.push(a.map((x) => String(x)).join(' '))
	}
})

afterEach(() => {
	console.log = originalLog
	console.error = originalErr
	mock.restore()
	captured.length = 0
})

// Patch the default registry by intercepting the import.
const installerModule = await import('@omnimesh/installer')

function patchRegistry(extras: Capability[]): void {
	for (const c of extras) installerModule.defaultRegistry.register(c)
}

describe('omni install', () => {
	test('lists all capabilities when called with no args', async () => {
		const { installCommand } = await import('../commands/install.ts')
		const code = await installCommand.run({
			args: [],
			flags: {},
		})
		expect(code).toBe(0)
		const text = logs.join('\n')
		expect(text).toContain('qvac')
		expect(text).toContain('ffmpeg')
		expect(text).toContain('vulkan')
		expect(text).toContain('openwakeword')
		expect(text).toContain('bonjour')
	})

	test('prints installable capabilities via --list', async () => {
		const { installCommand } = await import('../commands/install.ts')
		const code = await installCommand.run({
			args: [],
			flags: { list: true },
		})
		expect(code).toBe(0)
		expect(logs.join('\n')).toContain('qvac')
	})

	test('rejects unknown capability names with exit code 1', async () => {
		const { installCommand } = await import('../commands/install.ts')
		const code = await installCommand.run({
			args: ['not-a-real-cap'],
			flags: { yes: true },
		})
		expect(code).toBe(1)
		expect(errs.join('\n')).toContain('unknown capability')
	})

	test('rejects --target until dispatch lands in 9.4', async () => {
		const { installCommand } = await import('../commands/install.ts')
		const code = await installCommand.run({
			args: ['qvac'],
			flags: { target: 'worker-1' },
		})
		expect(code).toBe(2)
		expect(errs.join('\n')).toContain('--target')
	})

	test('rejects multiple positional args', async () => {
		const { installCommand } = await import('../commands/install.ts')
		const code = await installCommand.run({
			args: ['qvac', 'ffmpeg'],
			flags: {},
		})
		expect(code).toBe(2)
	})

	test('runs a local install and exits 0 on success', async () => {
		const fake = fakeCap({ name: 'cli-test-ok', delayMs: 5 })
		patchRegistry([fake])
		try {
			const { installCommand } = await import('../commands/install.ts')
			const code = await installCommand.run({
				args: ['cli-test-ok'],
				flags: { yes: true, quiet: true },
			})
			expect(code).toBe(0)
			const text = logs.join('\n')
			expect(text).toMatch(/cli-test-ok.*1\.0\.0/)
		} finally {
			// Restore: re-register the original capability to undo.
			installerModule.defaultRegistry.register({
				...fake,
				name: '__removed__',
			})
		}
	})
})
