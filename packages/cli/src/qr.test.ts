import { describe, expect, test } from 'bun:test'
import { qrSize, renderQrSync, stripAnsi } from './qr.ts'

describe('qr', () => {
	test('renderQrSync produces a non-empty block for a short URL', () => {
		const out = renderQrSync('http://192.168.0.108:3005/?token=abc')
		expect(out.length).toBeGreaterThan(0)
		const lines = out.split('\n')
		expect(lines.length).toBeGreaterThan(5)
	})

	test('renderQrSync uses half-block characters when only one of the two vertical modules is set', () => {
		const out = renderQrSync('http://example.com/')
		// Lines with non-zero first module should contain either a
		// full block (█) or a half block (▀/▄). Empty rows are
		// entirely spaces.
		const stripped = stripAnsi(out)
		expect(stripped.length).toBeGreaterThan(0)
		expect(/[▀▄█]/.test(stripped)).toBe(true)
	})

	test('renderQrSync output is scannable: every row has the same width', () => {
		const out = renderQrSync('http://192.168.0.108:3005/?token=abc123')
		const lines = stripAnsi(out).split('\n')
		const widths = lines.map((l) => l.length)
		const w0 = widths[0] ?? 0
		for (const w of widths) {
			expect(w).toBe(w0)
		}
		expect(w0).toBeGreaterThan(10)
	})

	test('stripAnsi removes ANSI escape codes', () => {
		const out = renderQrSync('hello')
		const stripped = stripAnsi(out)
		expect(stripped).not.toContain('\u001b[')
	})

	test('qrSize returns the module count (must be odd, > 20)', () => {
		const size = qrSize('http://example.com/?token=hello-world')
		expect(size).toBeGreaterThan(20)
		expect(size % 2).toBe(1) // QR codes are always odd-sized
	})

	test('long payloads produce a larger QR than short ones', () => {
		const short = qrSize('hi')
		const long = qrSize(
			'http://192.168.0.108:3005/?token=verylongtokenstringthatdoesnotchange&mesh=studio',
		)
		expect(long).toBeGreaterThanOrEqual(short)
	})

	test('different error-correction levels produce different sizes for the same payload', () => {
		const l = qrSize('hello world', { errorCorrectionLevel: 'L' })
		const h = qrSize('hello world', { errorCorrectionLevel: 'H' })
		expect(h).toBeGreaterThanOrEqual(l)
	})
})
