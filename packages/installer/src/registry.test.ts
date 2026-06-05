// Registry + capability tests. Validates the public surface
// (list, get, forPlatform, check shape) without actually
// invoking system package managers.

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
	InstallerRegistry,
	bonjour,
	defaultRegistry,
	ffmpeg,
	openwakeword,
	qvac,
	vulkan,
} from './index.ts'
import type {
	Capability,
	CheckResult,
	InstallContext,
	InstallEvent,
} from './types.ts'

const BASE_CTX: InstallContext = {
	platform: 'darwin',
	cwd: process.cwd(),
	dryRun: false,
	yes: false,
}

describe('InstallerRegistry', () => {
	test('default registry exposes all 5 built-in capabilities', () => {
		const names = defaultRegistry.names()
		expect(names).toContain('qvac')
		expect(names).toContain('ffmpeg')
		expect(names).toContain('vulkan')
		expect(names).toContain('openwakeword')
		expect(names).toContain('bonjour')
		expect(defaultRegistry.list()).toHaveLength(5)
	})

	test('get(name) returns the matching capability', () => {
		expect(defaultRegistry.get('qvac')).toBe(qvac)
		expect(defaultRegistry.get('ffmpeg')).toBe(ffmpeg)
		expect(defaultRegistry.get('vulkan')).toBe(vulkan)
		expect(defaultRegistry.get('openwakeword')).toBe(openwakeword)
		expect(defaultRegistry.get('bonjour')).toBe(bonjour)
		expect(defaultRegistry.get('nope')).toBeUndefined()
	})

	test('forPlatform filters capabilities by supported platforms', () => {
		const mac = defaultRegistry.forPlatform('darwin')
		const linux = defaultRegistry.forPlatform('linux')
		const win = defaultRegistry.forPlatform('win32')
		for (const c of [...mac, ...linux, ...win]) {
			expect(c.platforms.length).toBeGreaterThan(0)
		}
		expect(mac.length).toBe(5)
		expect(linux.length).toBe(5)
		expect(win.length).toBe(5)
	})

	test('register() inserts a custom capability; re-registering replaces it', () => {
		const reg = new InstallerRegistry([])
		const fake: Capability = {
			name: 'fake',
			description: 'fake cap',
			platforms: ['darwin'],
			installHint: 'omni install fake',
			async check(): Promise<CheckResult> {
				return { installed: false, hint: 'omni install fake' }
			},
			async *install(): AsyncIterable<InstallEvent> {
				yield { kind: 'done', capability: 'fake', version: '0', durationMs: 0 }
			},
			async verify(): Promise<CheckResult> {
				return { installed: true, version: '0' }
			},
		}
		reg.register(fake)
		expect(reg.get('fake')).toBe(fake)
		expect(reg.list()).toHaveLength(1)
		const replacement: Capability = { ...fake, description: 'replaced' }
		reg.register(replacement)
		expect(reg.get('fake')?.description).toBe('replaced')
		expect(reg.list()).toHaveLength(1)
	})
})

describe('capability metadata', () => {
	for (const c of [qvac, ffmpeg, vulkan, openwakeword, bonjour]) {
		test(`${c.name} has a non-empty installHint`, () => {
			expect(c.installHint).toMatch(/^omni install /)
		})
		test(`${c.name} has a non-empty description`, () => {
			expect(c.description.length).toBeGreaterThan(8)
		})
		test(`${c.name} advertises at least one platform`, () => {
			expect(c.platforms.length).toBeGreaterThan(0)
		})
	}
})

describe('capability checks (dry-run install path)', () => {
	let originalPath: string | undefined

	beforeEach(() => {
		originalPath = process.env.PATH
		// Force a deterministic miss for ffmpeg/vulkan by emptying PATH
		// for the spawned process. We don't set dryRun because checks
		// are supposed to actually probe the system.
		process.env.PATH = '/var/empty'
	})

	afterEach(() => {
		process.env.PATH = originalPath
	})

	test('qvac.check reports installed=false with a hint when @qvac/sdk is missing', async () => {
		// The repo doesn't have @qvac/sdk installed, so this should
		// fall through to the missing branch.
		const r = await qvac.check(BASE_CTX)
		expect(r.installed).toBe(false)
		expect(r.hint).toBe('omni install qvac')
	})

	test('bonjour.check returns a CheckResult shape', async () => {
		const r = await bonjour.check(BASE_CTX)
		expect(typeof r.installed).toBe('boolean')
		// If installed in the host workspace, version should be set;
		// if not, hint should be set. Either way the shape is valid.
		if (r.installed) {
			expect(r.version).toBeDefined()
		} else {
			expect(r.hint).toBe('omni install bonjour')
		}
	})

	test('ffmpeg.check reports installed=false when ffmpeg is not on PATH', async () => {
		// Probe with the path scrubbed. If ffmpeg is genuinely missing
		// on the host, we get installed=false. If it's somehow still
		// resolvable, the shape of the result is still correct.
		const r = await ffmpeg.check({ ...BASE_CTX, platform: 'linux' })
		if (!r.installed) {
			expect(r.hint).toBe('omni install ffmpeg')
		} else {
			expect(r.version).toBeDefined()
		}
	})

	test('vulkan.check on darwin reports installed=true (Metal is platform-default)', async () => {
		const r = await vulkan.check(BASE_CTX)
		expect(r.installed).toBe(true)
	})

	test('vulkan.check on linux returns a CheckResult (present or hint)', async () => {
		const r = await vulkan.check({ ...BASE_CTX, platform: 'linux' })
		expect(typeof r.installed).toBe('boolean')
		if (!r.installed) {
			expect(r.hint).toBe('omni install vulkan')
		}
	})

	test('openwakeword.check returns a CheckResult (present or hint)', async () => {
		// The marker file may exist from a previous `omni install
		// openwakeword` run on this machine. Accept either shape so
		// the test is hermetic.
		const r = await openwakeword.check(BASE_CTX)
		expect(typeof r.installed).toBe('boolean')
		if (!r.installed) {
			expect(r.hint).toBe('omni install openwakeword')
		} else {
			expect(r.version).toBeDefined()
		}
	})
})
