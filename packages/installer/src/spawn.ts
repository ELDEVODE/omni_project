// Spawn helper used by every capability. Centralised so the
// `dryRun` / `abortSignal` semantics are consistent and the test
// suite can patch `runCommand` to fake a shell.

import type { InstallContext } from './types.ts'

export type SpawnResult = {
	exitCode: number
	stdout: string
	stderr: string
	durationMs: number
	spawned: boolean
	command: string[]
}

export type RunOptions = {
	cwd?: string
	env?: Record<string, string>
	timeoutMs?: number
}

export async function runCommand(
	cmd: string[],
	opts: RunOptions,
	ctx: InstallContext,
): Promise<SpawnResult> {
	const start = Date.now()
	if (ctx.dryRun) {
		return {
			exitCode: 0,
			stdout: '',
			stderr: '',
			durationMs: 0,
			spawned: false,
			command: cmd,
		}
	}
	let proc: ReturnType<typeof Bun.spawn>
	try {
		proc = Bun.spawn({
			cmd,
			cwd: opts.cwd ?? ctx.cwd,
			env: { ...process.env, ...(opts.env ?? {}) },
			stdout: 'pipe',
			stderr: 'pipe',
		})
	} catch (err) {
		// Bun throws synchronously for ENOENT. Treat as a clean
		// "not found" so the check() callers get a deterministic
		// result instead of a thrown exception.
		return {
			exitCode: 127,
			stdout: '',
			stderr: (err as Error).message,
			durationMs: Date.now() - start,
			spawned: false,
			command: cmd,
		}
	}
	const timeout = opts.timeoutMs ?? 300_000
	const timer = setTimeout(() => {
		try {
			proc.kill()
		} catch {
			// already exited
		}
	}, timeout)
	const exit = await proc.exited.catch(() => 1)
	clearTimeout(timer)
	const stdout = await readStream(proc.stdout)
	const stderr = await readStream(proc.stderr)
	return {
		exitCode: exit,
		stdout,
		stderr,
		durationMs: Date.now() - start,
		spawned: true,
		command: cmd,
	}
}

export function requireRootHint(
	platform: 'darwin' | 'linux' | 'win32',
): string {
	if (platform === 'darwin') return 'no sudo needed (brew handles elevation)'
	if (platform === 'win32')
		return 'run from an elevated PowerShell if winget is missing'
	return 'requires sudo (or run as root)'
}

export function maybeSudo(cmd: string[], platform: 'linux'): string[] {
	if (platform !== 'linux') return cmd
	if (process.getuid && process.getuid() === 0) return cmd
	return ['sudo', ...cmd]
}

async function readStream(
	stream: ReadableStream<Uint8Array> | number | null | undefined,
): Promise<string> {
	if (stream == null) return ''
	if (typeof stream === 'number') return ''
	return new Response(stream).text()
}
