// OMNI CLI progress primitives — spinner, progress bar, and multi-step
// stepper. All output goes to stderr so it never pollutes the real stdout
// (important for `omni models run`, which streams tokens there).
//
// All three controllers auto-detect TTY. On a non-TTY (CI, piped output,
// backgrounded process), they degrade to plain newline-delimited output so
// downstream tools can still parse the log.

import { c } from './banner.js'

// ---------------------------------------------------------------------------
// TTY detection — guarded with try/catch because `process.stdout.isTTY` can
// throw on some obscure bundling targets. We want this module to never crash
// the CLI on import.

const isTTY =
	typeof process !== 'undefined' &&
	process.stderr &&
	typeof (process.stderr as { isTTY?: boolean }).isTTY === 'boolean' &&
	(process.stderr as { isTTY?: boolean }).isTTY === true

// ---------------------------------------------------------------------------
// Cursor / erase helpers
//
// CLEAR_LINE: erase the entire current line so the next \r overprint is clean.
// HIDE_CURSOR / SHOW_CURSOR: hide the caret while a spinner is animating so
// it doesn't jump around as we redraw.

const CLEAR_LINE = '\u001b[2K'
const HIDE_CURSOR = '\u001b[?25l'
const SHOW_CURSOR = '\u001b[?25h'
const CR = '\r'

// ---------------------------------------------------------------------------
// Formatters

export function fmtBytes(n: number): string {
	if (!Number.isFinite(n) || n < 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	let i = 0
	let v = n
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024
		i++
	}
	return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function fmtRate(bytesPerSec: number): string {
	if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 B/s'
	return `${fmtBytes(bytesPerSec)}/s`
}

export function fmtEta(secs: number): string {
	if (!Number.isFinite(secs) || secs < 0 || secs > 9_999_999) return '--:--'
	const s = Math.round(secs)
	const m = Math.floor(s / 60)
	const h = Math.floor(m / 60)
	if (h > 0) {
		return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
	}
	return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function fmtElapsed(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000))
	const m = Math.floor(s / 60)
	const h = Math.floor(m / 60)
	if (h > 0) {
		return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
	}
	return `${m}:${String(s % 60).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// spinner(text, opts?) — animated 4-frame spinner with elapsed-time suffix.
//
// Usage:
//   const s = spinner('starting host…')
//   await longOp()
//   s.succeed('host ready')
//
// `opts.intervalMs` is the frame interval (default 80ms). `opts.color` is the
// glyph color (default cyan). Frames cycle on a fixed timer; `update()` only
// changes the text, not the frame.

const FRAMES = ['⠋', '⠙', '⠹', '⠸']

export interface SpinnerOpts {
	intervalMs?: number
	color?: string
}

export interface Spinner {
	update(text: string): void
	succeed(text?: string): void
	fail(text?: string): void
	warn(text?: string): void
	stop(): void
}

export function spinner(text: string, opts: SpinnerOpts = {}): Spinner {
	const interval = opts.intervalMs ?? 80
	const color = opts.color ?? c.cyan
	const startedAt = Date.now()
	let current = text
	let frame = 0
	let stopped = false
	let timer: ReturnType<typeof setInterval> | null = null

	const render = () => {
		const glyph = `${color}${BOLD_START}${FRAMES[frame % FRAMES.length]}${RESET}`
		const elapsed = `${c.dim}${fmtElapsed(Date.now() - startedAt)}${RESET}`
		const line = `${glyph} ${current}  ${elapsed}`
		if (isTTY) {
			process.stderr.write(`${CLEAR_LINE}${CR}${line}`)
		}
	}

	const writeFinal = (glyph: string, glyphColor: string, msg: string) => {
		const elapsed = `${c.dim}${fmtElapsed(Date.now() - startedAt)}${RESET}`
		const finalGlyph = `${glyphColor}${BOLD_START}${glyph}${RESET}`
		const line = `${finalGlyph} ${msg}  ${elapsed}`
		if (isTTY) {
			process.stderr.write(`${CLEAR_LINE}${CR}${line}\n`)
		} else {
			process.stderr.write(`${line}\n`)
		}
	}

	if (isTTY) {
		process.stderr.write(HIDE_CURSOR)
		render()
		timer = setInterval(() => {
			if (stopped) return
			frame++
			render()
		}, interval)
	} else {
		// Non-TTY: emit a single line so the user still knows something is
		// happening. Updates are silent — the final state will be printed
		// when the spinner stops.
		process.stderr.write(`${c.cyan}⠋${RESET} ${current}\n`)
	}

	return {
		update(t: string) {
			if (stopped) return
			current = t
			if (isTTY) render()
		},
		succeed(t?: string) {
			if (stopped) return
			stopped = true
			if (timer) clearInterval(timer)
			if (isTTY) process.stderr.write(SHOW_CURSOR)
			writeFinal('✓', c.green, t ?? current)
		},
		fail(t?: string) {
			if (stopped) return
			stopped = true
			if (timer) clearInterval(timer)
			if (isTTY) process.stderr.write(SHOW_CURSOR)
			writeFinal('✗', c.red, t ?? current)
		},
		warn(t?: string) {
			if (stopped) return
			stopped = true
			if (timer) clearInterval(timer)
			if (isTTY) process.stderr.write(SHOW_CURSOR)
			writeFinal('!', c.yellow, t ?? current)
		},
		stop() {
			if (stopped) return
			stopped = true
			if (timer) clearInterval(timer)
			if (isTTY) {
				process.stderr.write(SHOW_CURSOR)
				process.stderr.write(`${CLEAR_LINE}${CR}`)
			}
		},
	}
}

// ---------------------------------------------------------------------------
// progressBar(total, opts?) — in-place bar with %, count, and optional rate.
//
// Usage:
//   const bar = progressBar(1024 * 1024 * 100)
//   for (let i = 0; i < 100; i++) {
//     bar.tick(i * 1024 * 1024, 'downloading')
//     await downloadChunk()
//   }
//   bar.done('done')
//
// The bar redraws the same terminal line via \r + CLEAR_LINE; it does NOT
// emit a newline until `done()`/`fail()`/`stop()`.

const BOLD_START = c.bold
const RESET = c.reset

export interface ProgressBarOpts {
	width?: number
	color?: string
	showEta?: boolean
	showRate?: boolean
	format?: 'bytes' | 'count' | 'percent'
}

export interface ProgressBar {
	tick(current: number, message?: string): void
	done(message?: string): void
	fail(message?: string): void
	stop(): void
}

export function progressBar(
	total: number,
	opts: ProgressBarOpts = {},
): ProgressBar {
	const width = opts.width ?? 28
	const color = opts.color ?? c.cyan
	const showEta = opts.showEta ?? true
	const showRate = opts.showRate ?? true
	const format = opts.format ?? (total > 1024 ? 'bytes' : 'count')
	const startedAt = Date.now()
	let lastTickAt = startedAt
	let lastCurrent = 0
	let lastMessage = ''
	let stopped = false

	const render = (current: number, message: string) => {
		const safeTotal = total > 0 ? total : 1
		const pct = Math.max(0, Math.min(1, current / safeTotal))
		const filled = Math.round(pct * width)
		const empty = width - filled
		const filledStr = '█'.repeat(filled)
		const emptyStr = '░'.repeat(empty)
		const pctStr = `${(pct * 100).toFixed(0).padStart(3)}%`
		const countStr =
			format === 'bytes'
				? `${fmtBytes(current)} / ${fmtBytes(total)}`
				: format === 'percent'
					? message
					: `${current} / ${total}`

		const now = Date.now()
		const dt = (now - lastTickAt) / 1000
		const dn = current - lastCurrent
		const rate = dt > 0 ? dn / dt : 0
		lastTickAt = now
		lastCurrent = current

		const parts = [
			`[${color}${filledStr}${c.dim}${emptyStr}${RESET}]`,
			pctStr,
			countStr,
		]
		if (showRate) parts.push(fmtRate(rate))
		if (showEta && rate > 0) {
			const remaining = (safeTotal - current) / rate
			parts.push(`ETA ${fmtEta(remaining)}`)
		}
		if (message) parts.push(`${c.dim}${message}${RESET}`)

		const line = parts.join('  ')
		if (isTTY) {
			process.stderr.write(`${CLEAR_LINE}${CR}${line}`)
		}
	}

	const writeFinal = (glyph: string, glyphColor: string, msg: string) => {
		const pctStr = '100%'
		const countStr =
			format === 'bytes'
				? `${fmtBytes(total)} / ${fmtBytes(total)}`
				: `${total} / ${total}`
		const line = `${glyphColor}${BOLD_START}${glyph}${RESET} ${msg}  ${c.dim}${countStr}  ${pctStr}  ${fmtElapsed(Date.now() - startedAt)}${RESET}`
		if (isTTY) {
			process.stderr.write(`${CLEAR_LINE}${CR}${line}\n`)
		} else {
			process.stderr.write(`${line}\n`)
		}
	}

	if (!isTTY) {
		// Non-TTY: emit a single line so consumers see intent; the final
		// state is printed on done/fail.
		process.stderr.write(`${c.cyan}…${RESET} 0% (0 / ${total})\n`)
	}

	return {
		tick(current: number, message?: string) {
			if (stopped) return
			lastMessage = message ?? lastMessage
			if (isTTY) render(current, lastMessage)
		},
		done(message?: string) {
			if (stopped) return
			stopped = true
			writeFinal('✓', c.green, message ?? lastMessage ?? 'done')
		},
		fail(message?: string) {
			if (stopped) return
			stopped = true
			writeFinal('✗', c.red, message ?? lastMessage ?? 'failed')
		},
		stop() {
			if (stopped) return
			stopped = true
			if (isTTY) process.stderr.write(`${CLEAR_LINE}${CR}`)
		},
	}
}

// ---------------------------------------------------------------------------
// multiStep(steps[]) — vertical checklist with pending/active/done states.
//
// Usage:
//   const boot = multiStep([
//     { label: 'starting host process…' },
//     { label: 'waiting for /api/health on :3005' },
//     { label: 'host ready' },
//   ])
//   boot.activate(0)
//   await spawnHost()
//   boot.complete(0)
//   boot.activate(1)
//   ...
//
// Each step is rendered on its own line. The active step shows the animated
// spinner in place. When `complete(n)` is called, the line is replaced with
// a green ✓ + the step's `finalLabel` (defaults to `label`).

export type StepStatus = 'pending' | 'active' | 'done' | 'failed'

export interface Step {
	label: string
	finalLabel?: string
}

export interface Stepper {
	activate(i: number, message?: string): void
	update(i: number, message: string): void
	complete(i: number, finalLabel?: string): void
	fail(i: number, finalLabel?: string): void
}

export function multiStep(steps: Step[]): Stepper {
	const statuses: StepStatus[] = steps.map(() => 'pending')
	const messages: (string | undefined)[] = steps.map(() => undefined)

	// In TTY mode we render the whole list every redraw, so we need to
	// emit the steps in a fixed top-down order. We do that by tracking how
	// many steps have been "finalized" (done/failed) vs how many are still
	// in flight. Once a step is finalized, its spinner stops and its line
	// is rewritten to the final state. Active steps get their own spinner
	// instance.

	// Helper to render a single step line.
	const renderLine = (i: number): string => {
		const status = statuses[i] ?? 'pending'
		const label = messages[i] ?? steps[i]?.label ?? ''
		switch (status) {
			case 'pending':
				return `${c.dim}  ·  ${label}${RESET}`
			case 'active':
				return `${c.cyan}${BOLD_START}⠋${RESET}  ${label}`
			case 'done':
				return `${c.green}${BOLD_START}✓${RESET}  ${steps[i]?.finalLabel ?? steps[i]?.label ?? ''}`
			case 'failed':
				return `${c.red}${BOLD_START}✗${RESET}  ${steps[i]?.finalLabel ?? steps[i]?.label ?? ''}`
		}
	}

	// In TTY mode we redraw by:
	// 1) moving cursor up by the number of lines we've already drawn below
	//    the current step, 2) clearing each line, 3) re-emitting.
	// To keep this simple we track the number of "drawn" lines (== highest
	// activated/finalized step index + 1) and re-render from index 0 up to
	// that point on every change.
	let linesDrawn = 0
	const redraw = () => {
		if (!isTTY) return
		if (linesDrawn > 0) {
			process.stderr.write(`\u001b[${linesDrawn}A`)
		}
		for (let i = 0; i < linesDrawn; i++) {
			process.stderr.write(`${CLEAR_LINE}${CR}`)
			process.stderr.write(renderLine(i))
			if (i < linesDrawn - 1) process.stderr.write('\n')
		}
	}

	return {
		activate(i: number, message?: string) {
			if (statuses[i] === 'done' || statuses[i] === 'failed') return
			statuses[i] = 'active'
			messages[i] = message ?? steps[i]?.label
			if (isTTY) {
				if (i >= linesDrawn) {
					// First time we've drawn this line — emit it on a new row.
					if (linesDrawn > 0) process.stderr.write('\n')
					linesDrawn = i + 1
				}
				redraw()
			} else {
				process.stderr.write(`${c.cyan}⠋${RESET}  ${messages[i]}\n`)
			}
		},
		update(i: number, message: string) {
			if (statuses[i] !== 'active') return
			messages[i] = message
			if (isTTY) redraw()
		},
		complete(i: number, finalLabel?: string) {
			if (statuses[i] === 'done' || statuses[i] === 'failed') return
			statuses[i] = 'done'
			const step = steps[i]
			if (finalLabel && step) step.finalLabel = finalLabel
			if (isTTY) {
				if (i >= linesDrawn) {
					if (linesDrawn > 0) process.stderr.write('\n')
					linesDrawn = i + 1
				}
				redraw()
			} else {
				process.stderr.write(
					`${c.green}✓${RESET}  ${step?.finalLabel ?? step?.label}\n`,
				)
			}
		},
		fail(i: number, finalLabel?: string) {
			if (statuses[i] === 'done' || statuses[i] === 'failed') return
			statuses[i] = 'failed'
			const step = steps[i]
			if (finalLabel && step) step.finalLabel = finalLabel
			if (isTTY) {
				if (i >= linesDrawn) {
					if (linesDrawn > 0) process.stderr.write('\n')
					linesDrawn = i + 1
				}
				redraw()
			} else {
				process.stderr.write(
					`${c.red}✗${RESET}  ${step?.finalLabel ?? step?.label}\n`,
				)
			}
		},
	}
}
