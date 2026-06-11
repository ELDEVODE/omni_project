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
import {
	type ProgressBar,
	type Spinner,
	progressBar,
	spinner,
} from '../ui/progress.ts'

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

async function runWithTimeout(
	cmd: string[],
	timeoutMs: number,
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
	const proc = Bun.spawn(cmd, {
		stdout: 'pipe',
		stderr: 'pipe',
	})
	const exitPromise = proc.exited
	const stdoutPromise = new Response(proc.stdout).text()
	const stderrPromise = new Response(proc.stderr).text()
	const timeoutPromise = new Promise<number | null>((resolve) =>
		setTimeout(() => {
			try {
				proc.kill('SIGKILL')
			} catch {}
			resolve(null)
		}, timeoutMs),
	)
	const exitCode = await Promise.race([exitPromise, timeoutPromise])
	if (exitCode === null) {
		return { exitCode: null, stdout: '', stderr: 'timeout' }
	}
	const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise])
	return { exitCode, stdout, stderr }
}

async function checkCommandAvailable(
	cmd: string,
	timeoutMs: number,
): Promise<boolean> {
	try {
		const proc = Bun.spawn(['which', cmd], {
			stdout: 'pipe',
			stderr: 'pipe',
		})
		const exitPromise = proc.exited
		const timeoutPromise = new Promise<number | null>((resolve) =>
			setTimeout(() => {
				try {
					proc.kill('SIGKILL')
				} catch {}
				resolve(null)
			}, timeoutMs),
		)
		const exitCode = await Promise.race([exitPromise, timeoutPromise])
		if (exitCode === null) return false
		await proc.exited
		return exitCode === 0
	} catch {
		return false
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
			key: 'qvac-cli',
			run: async () => {
				const hasQvacBin = await checkCommandAvailable('qvac', 2000)
				if (hasQvacBin) {
					return {
						key: 'qvac cli',
						value: 'qvac binary available',
						status: 'ok',
					}
				}
				return {
					key: 'qvac cli',
					value: 'not installed (run: npm install -g @qvac/cli)',
					status: 'warn',
				}
			},
		},
		{
			key: 'qvac-cli-doctor',
			run: async () => {
				const hasQvacBin = await checkCommandAvailable('qvac', 2000)
				if (!hasQvacBin) {
					return {
						key: 'qvac cli doctor',
						value: 'not run (install @qvac/cli)',
						status: 'warn',
					}
				}
				try {
					const proc = await runWithTimeout(['qvac', 'doctor', '--json'], 10000)
					if (proc.exitCode === 0) {
						const report: {
							ok: boolean
							sections?: Array<{ checks?: Array<{ status: string }> }>
						} = JSON.parse(proc.stdout)
						const failed =
							report.sections?.flatMap(
								(s) => s.checks?.filter((c) => c.status === 'fail') ?? [],
							).length ?? 0
						const warned =
							report.sections?.flatMap(
								(s) => s.checks?.filter((c) => c.status === 'warn') ?? [],
							).length ?? 0
						return {
							key: 'qvac cli doctor',
							value: `${report.ok ? 'pass' : 'fail'} (${failed} fail, ${warned} warn)`,
							status: report.ok ? 'ok' : 'warn',
							detail: JSON.stringify(report),
						}
					}
					return {
						key: 'qvac cli doctor',
						value: 'not run (install @qvac/cli)',
						status: 'warn',
					}
				} catch {
					return {
						key: 'qvac cli doctor',
						value: 'check failed',
						status: 'warn',
					}
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
	const allChecks = buildChecks(registry)
	const total = allChecks.length
	for (let i = 0; i < allChecks.length; i++) {
		const check = allChecks[i]
		if (!check) continue
		const phaseSpinner = spinner(`checking ${i + 1}/${total}: ${check.key}…`)
		try {
			const row = await check.run()
			rows.push(row)
			if (check.fixable && check.capabilityName && row.status !== 'ok') {
				fixable.push(check)
			}
			phaseSpinner.succeed()
		} catch (err) {
			rows.push({
				key: check.key,
				value: `check failed: ${(err as Error).message}`,
				status: 'fail',
			})
			phaseSpinner.fail()
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
		// The runner can take a while (e.g. `npm install @qvac/sdk` over
		// a cold network), so we give each capability up to 5 minutes
		// before timing out.
		const queueSpinner: Spinner = spinner('queued…')
		const ui: { bar: ProgressBar | null; percent: number } = {
			bar: null,
			percent: 0,
		}
		const final = await new Promise<'done' | 'fail' | 'cancel' | 'timeout'>(
			(resolve) => {
				const unsub = runner.listen((s, ev) => {
					if (s.installId !== state.installId) return
					if (ev.kind === 'start') {
						queueSpinner.succeed('starting fix')
						ui.bar = progressBar(100, { format: 'percent', showRate: false })
					} else if (ev.kind === 'progress') {
						if (ui.bar) {
							ui.percent = ev.percent
							ui.bar.tick(ui.percent, `${ev.step}: ${ev.message}`)
						}
					} else if (ev.kind === 'log') {
						if (ui.bar) {
							ui.bar.tick(ui.percent, ev.message)
							ui.bar.stop()
						}
						// eslint-disable-next-line no-console
						console.log(`  ${c.dim}[${ev.level}]${c.reset} ${ev.message}`)
						if (s.status === 'running') {
							ui.bar = progressBar(100, { format: 'percent', showRate: false })
							ui.bar.tick(ui.percent, '(resumed)')
						}
					} else if (ev.kind === 'done') {
						if (ui.bar)
							ui.bar.done(`${name} ${ev.version} in ${ev.durationMs}ms`)
						else queueSpinner.succeed(`${name} ${ev.version}`)
						unsub()
						resolve('done')
					} else if (ev.kind === 'fail') {
						if (ui.bar) ui.bar.fail(`${name}: ${ev.message}`)
						else queueSpinner.fail(`${name}: ${ev.message}`)
						unsub()
						resolve('fail')
					} else if (ev.kind === 'cancel') {
						if (ui.bar) ui.bar.stop()
						else queueSpinner.warn('cancelled')
						unsub()
						resolve('cancel')
					}
				})
				setTimeout(() => {
					unsub()
					if (ui.bar) ui.bar.fail('timed out')
					else queueSpinner.fail('timed out')
					resolve('timeout')
				}, 5 * 60_000)
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
