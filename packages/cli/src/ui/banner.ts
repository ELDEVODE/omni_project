// OMNI banner — the wordmark that prints on every `omni <command>`
// invocation. The OMNI wordmark uses figlet "Slant" (hand-trimmed
// for tighter column alignment) and the tagline uses thin
// line-drawing characters that pair with the HUD theme used in
// the dashboard and docs site.

const RESET = '\u001b[0m'
const BOLD = '\u001b[1m'
const DIM = '\u001b[2m'
const CYAN = '\u001b[36m'
const GREEN = '\u001b[32m'
const YELLOW = '\u001b[33m'
const RED = '\u001b[31m'
const MAGENTA = '\u001b[35m'

export const c = {
	reset: RESET,
	bold: BOLD,
	dim: DIM,
	cyan: CYAN,
	green: GREEN,
	yellow: YELLOW,
	red: RED,
	magenta: MAGENTA,
}

// Hand-trimmed figlet "Slant" for OMNI. Each row is 4 chars tall
// on the shortest letter (I), 5 on the others. Width 28 chars.
const OMNI = [
	'    ___  __  __ ___ ',
	'   / _ \\/  |/  / _ \\',
	'  / __ \\ /|_/ / __ \\',
	' /_/ /_\\\\_/  /_/____/',
]

// Build the wordmark with a cyan→magenta horizontal gradient.
function gradientize(lines: string[]): string {
	return lines
		.map((line) => {
			const cells = line.split('')
			const out: string[] = []
			for (let i = 0; i < cells.length; i++) {
				const ch = cells[i]
				if (ch === undefined) continue
				if (ch === ' ') {
					out.push(ch)
					continue
				}
				const t = i / Math.max(cells.length - 1, 1)
				const color = t < 0.5 ? CYAN : t < 0.8 ? MAGENTA : YELLOW
				out.push(`${BOLD}${color}${ch}${RESET}`)
			}
			return `  ${out.join('')}`
		})
		.join('\n')
}

const TOP = `${CYAN}  ╭──────────────────────────────────────────────────────╮${RESET}`
const BOT = `${CYAN}  ╰──────────────────────────────────────────────────────╯${RESET}`

// Lowercase command name rendered with figlet "Slant" so it
// reads as the executable rather than the wordmark.
const OMNI_CMD = ['   __  __', '  /  |/  /', ' / /|_/ / ', '/_/  /_/  ']

function colorize(lines: string[], color: string): string {
	return lines.map((line) => `  ${BOLD}${color}${line}${RESET}`).join('\n')
}

export const BANNER = `
${TOP}
${CYAN}  │${RESET}                                                      ${CYAN}│${RESET}
${gradientize(OMNI)
	.split('\n')
	.map((l) => `${CYAN}  │${RESET}  ${l}    ${CYAN}│${RESET}`)
	.join('\n')}
${CYAN}  │${RESET}                                                      ${CYAN}│${RESET}
${CYAN}  │${RESET}   ${BOLD}${CYAN}SOVEREIGN  AI  FABRIC${RESET}  ${DIM}·${RESET}  ${BOLD}${GREEN}v0.1.0${RESET}                      ${CYAN}│${RESET}
${CYAN}  │${RESET}                                                      ${CYAN}│${RESET}
${colorize(OMNI_CMD, GREEN)
	.split('\n')
	.map((l) => `${CYAN}  │${RESET}  ${l}  ${CYAN}│${RESET}`)
	.join('\n')}
${CYAN}  │${RESET}   ${BOLD}${GREEN}omni${RESET}  ${DIM}— OmniMesh CLI${RESET}                                ${CYAN}│${RESET}
${CYAN}  │${RESET}                                                      ${CYAN}│${RESET}
${CYAN}  │${RESET}   ${DIM}one mesh · every device · no cloud${RESET}             ${CYAN}│${RESET}
${CYAN}  │${RESET}                                                      ${CYAN}│${RESET}
${BOT}
`
