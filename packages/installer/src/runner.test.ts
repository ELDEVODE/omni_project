// Runner tests. Uses a tiny fake capability to drive the state
// machine without touching the real install recipes.

import { afterEach, describe, expect, test } from 'bun:test'
import { InstallerRegistry } from './registry.ts'
import { InstallRunner, type RunState } from './runner.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from './types.ts'

function fakeCap(opts: {
	name: string
	durationMs?: number
	failOn?: 'progress' | 'done' | 'never'
}): Capability {
	const duration = opts.durationMs ?? 30
	return {
		name: opts.name,
		description: `fake ${opts.name}`,
		platforms: ['darwin', 'linux', 'win32'],
		installHint: `omni install ${opts.name}`,
		async check(): Promise<CheckResult> {
			return { installed: false, hint: `omni install ${opts.name}` }
		},
		async *install(ctx: InstallContext): AsyncIterable<InstallEvent> {
			yield {
				kind: 'progress',
				capability: opts.name,
				step: 'install',
				percent: 25,
				message: 'starting',
			}
			await new Promise<void>((resolve) => {
				const t = setTimeout(resolve, duration)
				ctx.abortSignal?.addEventListener('abort', () => {
					clearTimeout(t)
					resolve()
				})
			})
			if (ctx.abortSignal?.aborted) {
				yield { kind: 'cancel', capability: opts.name }
				return
			}
			yield {
				kind: 'progress',
				capability: opts.name,
				step: 'install',
				percent: 75,
				message: 'halfway',
			}
			if (opts.failOn === 'progress') {
				yield {
					kind: 'fail',
					capability: opts.name,
					code: 'fake_fail',
					message: 'simulated failure',
				}
				return
			}
			yield {
				kind: 'done',
				capability: opts.name,
				version: '1.2.3',
				durationMs: duration,
			}
		},
		async verify(): Promise<CheckResult> {
			return { installed: true, version: '1.2.3' }
		},
	}
}

function waitFor(state: RunState, status: RunState['status']): Promise<void> {
	if (
		state.status === status ||
		state.status === 'fail' ||
		state.status === 'cancel'
	) {
		if (state.status === status) return Promise.resolve()
		return Promise.resolve()
	}
	return new Promise<void>((resolve) => {
		const id = setInterval(() => {
			if (state.status === status) {
				clearInterval(id)
				resolve()
			} else if (state.status === 'fail' || state.status === 'cancel') {
				clearInterval(id)
				resolve()
			}
		}, 5)
	})
}

describe('InstallRunner', () => {
	let registry: InstallerRegistry
	let runner: InstallRunner

	afterEach(() => {
		for (const _s of runner?.list() ?? []) {
			// best-effort cleanup
		}
	})

	test('enqueue returns a queued state and progresses to done', async () => {
		registry = new InstallerRegistry([fakeCap({ name: 'a' })])
		runner = new InstallRunner(registry)
		const state = runner.enqueue('a', { platform: 'darwin', dryRun: true })
		expect(state.status).toBe('queued')
		expect(state.installId).toMatch(/^inst-/)
		await waitFor(state, 'done')
		expect(state.status).toBe('done')
		expect(state.version).toBe('1.2.3')
		expect(state.percent).toBe(100)
	})

	test('serial execution: second install waits for first to finish', async () => {
		registry = new InstallerRegistry([
			fakeCap({ name: 'a', durationMs: 50 }),
			fakeCap({ name: 'b', durationMs: 10 }),
		])
		runner = new InstallRunner(registry)
		const a = runner.enqueue('a', { platform: 'darwin', dryRun: true })
		const b = runner.enqueue('b', { platform: 'darwin', dryRun: true })
		// Both start as queued; b should not enter 'running' before a finishes.
		expect(a.status).toBe('queued')
		expect(b.status).toBe('queued')
		await waitFor(a, 'done')
		await waitFor(b, 'done')
		expect(a.finishedAt).not.toBeUndefined()
		expect(b.finishedAt).not.toBeUndefined()
		if (a.finishedAt && b.finishedAt) {
			expect(a.finishedAt).toBeLessThanOrEqual(b.finishedAt)
		}
	})

	test('cancel before start moves state to cancel', async () => {
		registry = new InstallerRegistry([
			fakeCap({ name: 'a', durationMs: 50 }),
			fakeCap({ name: 'b' }),
		])
		runner = new InstallRunner(registry)
		const a = runner.enqueue('a', { platform: 'darwin', dryRun: true })
		const b = runner.enqueue('b', { platform: 'darwin', dryRun: true })
		const cancelled = runner.cancel(b.installId)
		expect(cancelled).toBe(true)
		await waitFor(a, 'done')
		expect(b.status).toBe('cancel')
		expect(b.message).toContain('cancel')
	})

	test('cancel during install aborts the in-flight capability', async () => {
		registry = new InstallerRegistry([fakeCap({ name: 'a', durationMs: 200 })])
		runner = new InstallRunner(registry)
		const a = runner.enqueue('a', { platform: 'darwin', dryRun: true })
		// Wait for the runner to pick it up
		await new Promise((r) => setTimeout(r, 10))
		expect(runner.cancel(a.installId)).toBe(true)
		await waitFor(a, 'cancel')
		expect(a.status).toBe('cancel')
	})

	test('listen() receives events for each install', async () => {
		registry = new InstallerRegistry([fakeCap({ name: 'a' })])
		runner = new InstallRunner(registry)
		const events: string[] = []
		runner.listen((state, ev) => {
			events.push(`${state.installId}:${ev.kind}`)
		})
		const a = runner.enqueue('a', { platform: 'darwin', dryRun: true })
		await waitFor(a, 'done')
		const kinds = events.filter((e) => e.startsWith(`${a.installId}:`))
		expect(kinds.length).toBeGreaterThan(0)
		expect(kinds.some((k) => k.endsWith(':start'))).toBe(true)
		expect(kinds.some((k) => k.endsWith(':done'))).toBe(true)
	})

	test('unknown capability moves state to fail with a clear error', async () => {
		registry = new InstallerRegistry([])
		runner = new InstallRunner(registry)
		const s = runner.enqueue('not-a-cap', { platform: 'darwin', dryRun: true })
		await waitFor(s, 'fail')
		expect(s.status).toBe('fail')
		expect(s.error).toContain('not-a-cap')
	})

	test('installId is unique per enqueue (regression: byCapability overwrite)', async () => {
		registry = new InstallerRegistry([fakeCap({ name: 'a', durationMs: 20 })])
		runner = new InstallRunner(registry)
		const a1 = runner.enqueue('a', { platform: 'darwin', dryRun: true })
		const a2 = runner.enqueue('a', { platform: 'darwin', dryRun: true })
		expect(a1.installId).not.toBe(a2.installId)
		await waitFor(a2, 'done')
		expect(a1.status).toBe('done')
		expect(a2.status).toBe('done')
	})

	test('list() returns every state ever enqueued', async () => {
		registry = new InstallerRegistry([fakeCap({ name: 'a' })])
		runner = new InstallRunner(registry)
		runner.enqueue('a', { platform: 'darwin', dryRun: true })
		runner.enqueue('a', { platform: 'darwin', dryRun: true })
		await new Promise((r) => setTimeout(r, 200))
		expect(runner.list().length).toBeGreaterThanOrEqual(2)
	})
})
