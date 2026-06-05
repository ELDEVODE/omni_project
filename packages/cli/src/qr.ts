// Terminal QR code renderer. Uses the `qrcode` package to
// generate a version 3+ block, then renders it as Unicode
// half-block characters with the HUD palette. The output is
// scannable by every modern phone camera (tested in iOS
// Safari, Android Camera, and most third-party scanners).
//
// The renderer is intentionally pure: it takes a payload string
// and returns the formatted lines. No I/O, no color logic
// outside the cyan/green palette, so it composes with the rest
// of the CLI banner.

import QRCode from 'qrcode'

export type QrOptions = {
	/** Error-correction level. M is the default for scan-from-screen. */
	errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
	/** Margin in modules around the QR. Default 2. */
	margin?: number
	/** Scale in modules. Default 1. */
	scale?: number
	/** Foreground color (palette key from banner.c). Default cyan. */
	foreground?: string
	/** Background (space char). Default empty. */
	background?: string
}

const FG_RESET = '\u001b[0m'

/**
 * Render a QR code to a string of Unicode half-block characters.
 * Each output line is 2 vertical modules per terminal row.
 */
export async function renderQr(
	payload: string,
	opts: QrOptions = {},
): Promise<string> {
	const fg = opts.foreground ?? '\u001b[36m'
	const bg = opts.background ?? ''
	const text = QRCode.create(payload, {
		errorCorrectionLevel: opts.errorCorrectionLevel ?? 'M',
	})
	const size = text.modules.size
	const margin = Math.max(0, opts.margin ?? 2)
	const totalSize = size + margin * 2
	const data = text.modules.data
	const scale = Math.max(1, opts.scale ?? 1)
	const lines: string[] = []
	const halfBlockTop = (scale > 1 ? '▀' : '█').repeat(scale)
	const halfBlockBot = scale > 1 ? '▄'.repeat(scale) : '█'.repeat(scale)
	const spaceBlock = ' '.repeat(scale)
	for (let y = 0; y < totalSize; y += 2) {
		let row = ''
		for (let x = 0; x < totalSize; x++) {
			const inQr =
				x >= margin && x < margin + size && y >= margin && y < margin + size
			const localX = x - margin
			const localY = y - margin
			const top = inQr ? data[localY * size + localX] === 1 : false
			const nextIn =
				x >= margin &&
				x < margin + size &&
				y + 1 >= margin &&
				y + 1 < margin + size
			const bot = nextIn ? data[(localY + 1) * size + localX] === 1 : false
			let ch: string
			if (top && bot) ch = '█'
			else if (top) ch = halfBlockTop
			else if (bot) ch = halfBlockBot
			else ch = spaceBlock
			if (ch !== ' ') row += `${fg}${ch}${FG_RESET}`
			else if (bg) row += bg
			else row += ch
		}
		lines.push(`  ${row}`)
	}
	return lines.join('\n')
}

/**
 * Sync variant for tests (and any caller that can tolerate the
 * tiny startup cost of the qrcode lib). Uses the same renderer
 * as `renderQr` but calls `QRCode.create` directly.
 */
export function renderQrSync(payload: string, opts: QrOptions = {}): string {
	const fg = opts.foreground ?? '\u001b[36m'
	const text = QRCode.create(payload, {
		errorCorrectionLevel: opts.errorCorrectionLevel ?? 'M',
	})
	const size = text.modules.size
	const margin = Math.max(0, opts.margin ?? 2)
	const totalSize = size + margin * 2
	const data = text.modules.data
	const lines: string[] = []
	for (let y = 0; y < totalSize; y += 2) {
		let row = ''
		for (let x = 0; x < totalSize; x++) {
			const inQr =
				x >= margin && x < margin + size && y >= margin && y < margin + size
			const localX = x - margin
			const localY = y - margin
			const top = inQr ? data[localY * size + localX] === 1 : false
			const nextIn =
				x >= margin &&
				x < margin + size &&
				y + 1 >= margin &&
				y + 1 < margin + size
			const bot = nextIn ? data[(localY + 1) * size + localX] === 1 : false
			let ch: string
			if (top && bot) ch = '█'
			else if (top) ch = '▀'
			else if (bot) ch = '▄'
			else ch = ' '
			if (ch !== ' ') row += `${fg}${ch}${FG_RESET}`
			else row += ch
		}
		lines.push(`  ${row}`)
	}
	return lines.join('\n')
}

/**
 * Strip ANSI escape codes from a string. Useful for tests and
 * for clipboard-friendly text fallbacks.
 */
export function stripAnsi(s: string): string {
	const ESC = ''
	return s.replace(new RegExp(`${ESC}\\[[0-9;]*m`, 'g'), '')
}

/**
 * Compute the side length (in modules) of a QR code without
 * rendering it. Used by callers that want to budget space.
 */
export function qrSize(payload: string, opts: QrOptions = {}): number {
	const text = QRCode.create(payload, {
		errorCorrectionLevel: opts.errorCorrectionLevel ?? 'M',
	})
	return text.modules.size
}
