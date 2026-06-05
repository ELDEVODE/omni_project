import {
	type Capability,
	type CheckResult,
	InstallRunner,
	type InstallerRegistry,
	defaultRegistry,
	detectPlatform,
} from '@omnimesh/installer'
import type { Command, CommandContext } from '../router.ts'
import { c } from '../ui/banner.ts'

export type DoctorStatus = 'ok' | 'warn' | 'fail'

export type DoctorRow = {
	key: string
	value: string
	status: DoctorStatus
	detail?: string
}

export type DoctorCheck = {
	key: string
	run: () => Promise<DoctorRow> | DoctorRow
	fixable?: boolean
	capabilityName?: string
}

function statString(path: string): { mtimeMs: number; size: number } | null {
	try {
		const fs = require('node:fs') as typeof import('node:fs')
		return fs.statSync(path)
	} catch {
		return null
	}
}

async function probePort(
	host: string,
	port: number,
	timeoutMs = 1000,
): Promise<{ open: boolean; ms: number; error?: string }> {
	const start = Date.now()
	try {
		await fetch(`http://${host}:${port}/api/health`, {
			signal: AbortSignal.timeout(timeoutMs),
		})
		return { open: true, ms: Date.now() - start }
	} catch (err) {
		return {
			open: false,
			ms: Date.now() - start,
			error: (err as Error).message,
		}
	}
}

function checkToRow(cap: Capability, result: CheckResult): DoctorRow {
	if (result.installed) {
		return {
			key: cap.name,
			value: result.version ?? result.path ?? 'installed',
			status: 'ok',
			...(result.path ? { detail: result.path } : {}),
		}
	}
	return {
		key: cap.name,
		value: result.hint ? `not installed (${result.hint})` : 'not installed',
		status: 'warn',
		detail: cap.installHint,
	}
}

function buildCapabilityChecks(registry: InstallerRegistry): DoctorCheck[] {
	return registry.names().map((name) => {
		const cap = registry.get(name)
		if (!cap) {
			return {
				key: name,
				run: () => ({
					key: name,
					value: 'unknown capability',
					status: 'fail' as DoctorStatus,
				}),
			}
		}
		return {
			key: cap.name,
			capabilityName: cap.name,
			fixable: true,
			run: async () => {
				const platform = detectPlatform()
				const result = await cap.check({
					platform,
					cwd: process.cwd(),
					dryRun: false,
					yes: false,
				})
				return checkToRow(cap, result)
			},
		}
	})
}

function staticChecks(): DoctorCheck[] {
	return [
		{
			key: 'runtime',
			run: () => ({
				key: 'bun',
				value: Bun.version,
				status: 'ok',
			}),
		},
		{
			key: 'node',
			run: () => ({ key: 'node', value: process.version, status: 'ok' }),
		},
		{
			key: 'platform',
			run: () => ({
				key: 'platform',
				value: `${process.platform}/${process.arch}`,
				status: 'ok',
			}),
		},
		{
			key: 'secret',
			run: () => {
				const path = `${process.env.HOME ?? '~'}/.omni/secret`
				const s = statString(path)
				if (!s) {
					return {
						key: 'secret',
						value: 'no file (will be created on first `omni host`)',
						status: 'warn',
					}
				}
				return {
					key: 'secret',
					value: `${path} (${s.size} bytes, mtime ${new Date(s.mtimeMs).toISOString()})`,
					status: 'ok',
				}
			},
		},
		{
			key: 'qvac-sdk',
			run: async () => {
				try {
					const proc = Bun.spawnSync(
						[
							'bunx',
							'--package=@qvac/sdk@0.12.2',
							'node',
							'-e',
							'import("@qvac/sdk")',
						],
						{
							stdout: 'pipe',
							stderr: 'pipe',
							timeout: 10000,
						},
					)
					if (proc.exitCode === 0) {
						return {
							key: 'qvac sdk',
							value: '@qvac/sdk@0.12.2 available',
							status: 'ok',
						}
					}
					return {
						key: 'qvac sdk',
						value: 'not installed (run: bun add @qvac/sdk)',
						status: 'warn',
					}
				} catch {
					return { key: 'qvac sdk', value: 'check failed', status: 'warn' }
				}
			},
		},
		{
			key: 'qvac-doctor',
			run: async () => {
				try {
					const proc = Bun.spawnSync(
						['bunx', '--package=@qvac/cli@0.6.0', 'qvac', 'doctor', '--json'],
						{
							stdout: 'pipe',
							stderr: 'pipe',
							timeout: 30000,
						},
					)
					if (proc.exitCode === 0) {
						const report: {
							ok: boolean
							sections?: Array<{ checks?: Array<{ status: string }> }>
						} = JSON.parse(new TextDecoder().decode(proc.stdout))
						const failed =
							report.sections?.flatMap(
								(s) => s.checks?.filter((c) => c.status === 'fail') ?? [],
							).length ?? 0
						const warned =
							report.sections?.flatMap(
								(s) => s.checks?.filter((c) => c.status === 'warn') ?? [],
							).length ?? 0
						return {
							key: 'qvac doctor',
							value: `${report.ok ? 'pass' : 'fail'} (${failed} fail, ${warned} warn)`,
							status: report.ok ? 'ok' : 'warn',
							detail: JSON.stringify(report),
						}
					}
					return {
						key: 'qvac doctor',
						value: 'not run (install @qvac/cli)',
						status: 'warn',
					}
				} catch {
					return { key: 'qvac doctor', value: 'check failed', status: 'warn' }
				}
			},
		},
		{
			key: 'host-http',
			run: () => {
				const host = process.env.OMNI_HOST ?? '127.0.0.1'
				const port = Number.parseInt(process.env.OMNI_PORT ?? '3005', 10)
				return (async (): Promise<DoctorRow> => {
					const r = await probePort(host, port)
					if (r.open) {
						return {
							key: 'host http',
							value: `${host}:${port} reachable (${r.ms}ms)`,
							status: 'ok',
						}
					}
					return {
						key: 'host http',
						value: `${host}:${port} unreachable${r.error ? `: ${r.error}` : ''}`,
						status: 'warn',
					}
				})()
			},
		},
		{
			key: 'openai-compat',
			run: () => {
				return (async (): Promise<DoctorRow> => {
					const r = await probePort('127.0.0.1', 11434, 500)
					if (r.open) {
						return {
							key: 'openai http',
							value: `127.0.0.1:11434 reachable (${r.ms}ms)`,
							status: 'ok',
						}
					}
					return {
						key: 'openai http',
						value: '127.0.0.1:11434 not listening (run `omni host` to enable)',
						status: 'warn',
					}
				})()
			},
		},
		{
			key: 'git',
			run: () => {
				try {
					const proc = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], {
						stdout: 'pipe',
						stderr: 'pipe',
					})
					if (proc.exitCode === 0) {
						return {
							key: 'git sha',
							value: new TextDecoder().decode(proc.stdout).trim(),
							status: 'ok',
						}
					}
					return { key: 'git sha', value: 'not a git checkout', status: 'warn' }
				} catch {
					return { key: 'git sha', value: 'git not found', status: 'warn' }
				}
			},
		},
	]
}

export function buildChecks(
	registry: InstallerRegistry = defaultRegistry,
): DoctorCheck[] {
	return [...staticChecks(), ...buildCapabilityChecks(registry)]
}

export const checks: DoctorCheck[] = buildChecks()

export type DoctorReport = {
	rows: DoctorRow[]
	failed: number
	warned: number
	fixable: DoctorCheck[]
}

export async function runChecks(
	registry: InstallerRegistry = defaultRegistry,
): Promise<DoctorReport> {
	const rows: DoctorRow[] = []
	const fixable: DoctorCheck[] = []
	for (const check of buildChecks(registry)) {
		try {
			const row = await check.run()
			rows.push(row)
			if (check.fixable && check.capabilityName && row.status !== 'ok') {
				fixable.push(check)
			}
		} catch (err) {
			rows.push({
				key: check.key,
				value: `check failed: ${(err as Error).message}`,
				status: 'fail',
			})
		}
	}
	let failed = 0
	let warned = 0
	for (const r of rows) {
		if (r.status === 'fail') failed++
		else if (r.status === 'warn') warned++
	}
	return { rows, failed, warned, fixable }
}

async function runFixes(
	fixable: DoctorCheck[],
	registry: InstallerRegistry,
): Promise<DoctorRow[]> {
	if (fixable.length === 0) return []
	const runner = new InstallRunner(registry)
	const platform = detectPlatform()
	const out: DoctorRow[] = []
	for (const check of fixable) {
		const name = check.capabilityName
		if (!name) continue
		// eslint-disable-next-line no-console
		console.log(`${c.cyan}→${c.reset} fixing: ${name}`)
		const state = runner.enqueue(name, {
			platform,
			cwd: process.cwd(),
			dryRun: false,
			yes: true,
		})
		const final = await new Promise<'done' | 'fail' | 'cancel' | 'timeout'>(
			(resolve) => {
				const unsub = runner.listen((s, ev) => {
					if (s.installId !== state.installId) return
					if (ev.kind === 'done') {
						unsub()
						resolve('done')
					} else if (ev.kind === 'fail') {
						unsub()
						resolve('fail')
					} else if (ev.kind === 'cancel') {
						unsub()
						resolve('cancel')
					} else if (ev.kind === 'log') {
						// stream log messages as they arrive
						// eslint-disable-next-line no-console
						console.log(`  ${c.dim}${ev.message}${c.reset}`)
					}
				})
				setTimeout(() => {
					unsub()
					resolve('timeout')
				}, 60_000)
			},
		)
		out.push({
			key: name,
			value:
				final === 'done'
					? 'fixed'
					: final === 'timeout'
						? 'fix timed out'
						: `fix ${final}`,
			status: final === 'done' ? 'ok' : 'warn',
		})
	}
	return out
}

function parseFixFlag(ctx: CommandContext): boolean {
	if (ctx.flags.fix === true) return true
	if (ctx.flags.fix) return Boolean(ctx.flags.fix)
	for (const a of ctx.args) {
		if (a === '--fix' || a === '-F') return true
	}
	return false
}

function render(rows: DoctorRow[]): number {
	let width = 0
	for (const { key } of rows) width = Math.max(width, key.length)
	let failed = 0
	let warned = 0
	for (const { key, value, status } of rows) {
		const color =
			status === 'ok' ? c.green : status === 'warn' ? c.yellow : c.red
		const symbol = status === 'ok' ? '✓' : status === 'warn' ? '!' : '✗'
		if (status === 'fail') failed++
		if (status === 'warn') warned++
		// eslint-disable-next-line no-console
		console.log(`  ${color}${symbol}${c.reset} ${key.padEnd(width)}  ${value}`)
	}
	// eslint-disable-next-line no-console
	console.log(
		`\n${c.dim}${rows.length} checks, ${failed} failed, ${warned} warnings${c.reset}`,
	)
	return failed > 0 ? 1 : 0
}

export const doctorCommand: Command = {
	name: 'doctor',
	description:
		'Check your environment + mesh health. Use --fix to install missing capabilities.',
	usage: 'doctor [--fix]',
	run: async (ctx) => {
		const fix = parseFixFlag(ctx)
		// eslint-disable-next-line no-console
		console.log(
			`${c.cyan}→${c.reset} OmniMesh doctor${fix ? ' (--fix)' : ''}\n`,
		)

		const report = await runChecks()
		const exitCode = render(report.rows)

		if (fix && report.fixable.length > 0) {
			// eslint-disable-next-line no-console
			console.log(
				`\n${c.cyan}→${c.reset} attempting fix for ${report.fixable.length} capabilities\n`,
			)
			const fixed = await runFixes(report.fixable, defaultRegistry)
			const rerun = await runChecks()
			const merged: DoctorRow[] = [...rerun.rows]
			for (const f of fixed) {
				const i = merged.findIndex((r) => r.key === f.key)
				if (i >= 0) merged[i] = f
			}
			// eslint-disable-next-line no-console
			console.log(`\n${c.cyan}→${c.reset} after fix:\n`)
			const newExit = render(merged)
			return Math.max(exitCode, newExit)
		}
		return exitCode
	},
}
