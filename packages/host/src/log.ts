type Level = 'debug' | 'info' | 'warn' | 'error'

const COLORS = {
	debug: '\u001b[90m',
	info: '\u001b[36m',
	warn: '\u001b[33m',
	error: '\u001b[31m',
	reset: '\u001b[0m',
}

const PREFIX = {
	debug: '·',
	info: '✓',
	warn: '!',
	error: '✗',
}

function emit(level: Level, msg: string, meta?: unknown): void {
	const ts = new Date().toISOString().split('T')[1]?.slice(0, 8) ?? ''
	const color = COLORS[level]
	const prefix = PREFIX[level]
	const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : ''
	// eslint-disable-next-line no-console
	console.log(
		`${color}${prefix}${COLORS.reset} ${ts} [${level}] ${msg}${metaStr}`,
	)
}

export const log = {
	debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
	info: (msg: string, meta?: unknown) => emit('info', msg, meta),
	warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
	error: (msg: string, meta?: unknown) => emit('error', msg, meta),
}
