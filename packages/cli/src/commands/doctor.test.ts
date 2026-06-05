import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { InstallerRegistry } from '@omnimesh/installer'
import {
	type DoctorRow,
	type DoctorStatus,
	buildChecks,
	runChecks,
} from './doctor.ts'

let tmpDir: string | null = null
const originalHome = process.env.HOME

function makeTmp(): string {
	tmpDir = mkdtempSync(join(tmpdir(), 'omni-doctor-'))
	return tmpDir
}

afterEach(() => {
	if (tmpDir) {
		rmSync(tmpDir, { recursive: true, force: true })
		tmpDir = null
	}
	if (originalHome !== undefined) process.env.HOME = originalHome
	else process.env.HOME = undefined
})

async function findCheck(name: string, checks: ReturnType<typeof buildChecks>) {
	const check = checks.find((c) => c.key === name)
	if (!check) throw new Error(`no check with key=${name}`)
	return await check.run()
}

function expectStatus(row: DoctorRow, status: DoctorStatus) {
	expect(row).toBeDefined()
	expect(row.status).toBe(status)
}

describe('omni doctor', () => {
	const checks = buildChecks()

	test('runtime check reports bun version', async () => {
		const row = await findCheck('runtime', checks)
		expectStatus(row, 'ok')
		expect(row.value).toMatch(/^\d+\.\d+\.\d+/)
	})

	test('node check reports process.version', async () => {
		const row = await findCheck('node', checks)
		expectStatus(row, 'ok')
		expect(row.value).toMatch(/^v\d+/)
	})

	test('platform check reports process.platform/arch', async () => {
		const row = await findCheck('platform', checks)
		expectStatus(row, 'ok')
		expect(row.value).toContain('/')
	})

	test('qvac check is warn with install hint when SDK is missing', async () => {
		const row = await findCheck('qvac', checks)
		expect(row.status === 'ok' || row.status === 'warn').toBe(true)
		if (row.status === 'warn') {
			expect(row.value.length).toBeGreaterThan(0)
			expect(row.detail ?? '').toMatch(/omni install qvac/)
		}
	})

	test('ffmpeg check is warn with optional hint when ffmpeg is missing', async () => {
		const row = await findCheck('ffmpeg', checks)
		expect(row.status === 'ok' || row.status === 'warn').toBe(true)
		expect(row.value.length).toBeGreaterThan(0)
	})

	test('secret check warns when no file is present', async () => {
		const dir = makeTmp()
		process.env.HOME = dir
		const row = await findCheck('secret', checks)
		expectStatus(row, 'warn')
		expect(row.value).toContain('no file')
	})

	test('secret check is ok when file exists', async () => {
		const dir = makeTmp()
		const omniDir = join(dir, '.omni')
		const fs = await import('node:fs')
		fs.mkdirSync(omniDir, { recursive: true })
		writeFileSync(join(omniDir, 'secret'), 'a'.repeat(32), { mode: 0o600 })
		process.env.HOME = dir

		const row = await findCheck('secret', checks)
		expectStatus(row, 'ok')
		expect(row.value).toContain('.omni/secret')
	})

	test('host-http check reports port 3005 status (ok when host is up, warn otherwise)', async () => {
		const row = await findCheck('host-http', checks)
		expect(row.status === 'ok' || row.status === 'warn').toBe(true)
		expect(row.value).toContain('127.0.0.1:3005')
	})

	test('openai-compat check reports port 11434 status (ok when server is up, warn otherwise)', async () => {
		const row = await findCheck('openai-compat', checks)
		expect(row.status === 'ok' || row.status === 'warn').toBe(true)
		expect(row.value).toContain('11434')
	})

	test('git check is ok with a short SHA or warn outside a git checkout', async () => {
		const row = await findCheck('git', checks)
		expect(row.status === 'ok' || row.status === 'warn').toBe(true)
	})

	test('all checks return a non-empty key/value', async () => {
		for (const c of checks) {
			const row = await c.run()
			expect(row.key.length).toBeGreaterThan(0)
			expect(row.value.length).toBeGreaterThan(0)
			expect(['ok', 'warn', 'fail']).toContain(row.status)
		}
	}, 120000)

	test('secret check does not throw when HOME is missing', async () => {
		process.env.HOME = undefined
		const row = await findCheck('secret', checks)
		expect(row.status === 'ok' || row.status === 'warn').toBe(true)
		expect(() => existsSync(tmpDir ?? '/nope')).not.toThrow()
	})

	test('runChecks with empty registry returns only static checks', async () => {
		const reg = new InstallerRegistry([])
		const report = await runChecks(reg)
		expect(report.rows.length).toBe(9)
		expect(report.fixable.length).toBe(0)
	}, 120000)

	test('runChecks with custom fake cap marks fixable when not installed', async () => {
		const reg = new InstallerRegistry([
			{
				name: 'fake',
				description: 'fake cap',
				platforms: ['darwin', 'linux', 'win32'],
				installHint: 'omni install fake',
				async check() {
					return { installed: false, hint: 'omni install fake' }
				},
				async *install() {
					yield {
						kind: 'done',
						capability: 'fake',
						version: '1.0.0',
						durationMs: 0,
					}
				},
				async verify() {
					return { installed: true, version: '1.0.0' }
				},
			},
		])
		const report = await runChecks(reg)
		const fakeRow = report.rows.find((r) => r.key === 'fake')
		expect(fakeRow).toBeDefined()
		expect(fakeRow?.status).toBe('warn')
		expect(report.fixable.length).toBe(1)
		expect(report.fixable[0]?.capabilityName).toBe('fake')
	}, 120000)

	test('runChecks with installed cap does not mark fixable', async () => {
		const reg = new InstallerRegistry([
			{
				name: 'present',
				description: 'present',
				platforms: ['darwin', 'linux', 'win32'],
				installHint: 'omni install present',
				async check() {
					return { installed: true, version: '1.0.0' }
				},
				async *install() {
					yield {
						kind: 'done',
						capability: 'present',
						version: '1.0.0',
						durationMs: 0,
					}
				},
				async verify() {
					return { installed: true, version: '1.0.0' }
				},
			},
		])
		const report = await runChecks(reg)
		const row = report.rows.find((r) => r.key === 'present')
		expect(row?.status).toBe('ok')
		expect(report.fixable.length).toBe(0)
	}, 120000)
})
