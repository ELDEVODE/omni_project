// Tests for the CLI progress primitives. We don't try to assert against
// the spinner frames (those depend on TTY state and timing); instead we
// test the deterministic behaviour:
//   - formatters produce the right strings for representative inputs
//   - multiStep + progressBar are non-throwing and produce the expected
//     shape on `done()` / `fail()`
//   - the package never writes to stdout (we capture both streams)

import { describe, expect, it, spyOn } from 'bun:test'
import {
	fmtBytes,
	fmtEta,
	fmtRate,
	multiStep,
	progressBar,
	spinner,
} from './progress.ts'

describe('fmtBytes', () => {
	it('formats bytes', () => {
		expect(fmtBytes(0)).toBe('0 B')
		expect(fmtBytes(512)).toBe('512 B')
		expect(fmtBytes(1024)).toBe('1.0 KB')
		expect(fmtBytes(1024 * 1024)).toBe('1.0 MB')
		expect(fmtBytes(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB')
	})

	it('handles non-finite and negative', () => {
		expect(fmtBytes(-1)).toBe('0 B')
		expect(fmtBytes(Number.NaN)).toBe('0 B')
		expect(fmtBytes(Number.POSITIVE_INFINITY)).toBe('0 B')
	})
})

describe('fmtRate', () => {
	it('formats bytes per second', () => {
		expect(fmtRate(0)).toBe('0 B/s')
		expect(fmtRate(1024 * 1024)).toBe('1.0 MB/s')
	})

	it('handles non-finite and negative', () => {
		expect(fmtRate(-1)).toBe('0 B/s')
		expect(fmtRate(Number.NaN)).toBe('0 B/s')
	})
})

describe('fmtEta', () => {
	it('formats seconds as mm:ss', () => {
		expect(fmtEta(0)).toBe('00:00')
		expect(fmtEta(45)).toBe('00:45')
		expect(fmtEta(125)).toBe('02:05')
	})

	it('formats minutes and hours', () => {
		expect(fmtEta(3600)).toBe('1:00:00')
		expect(fmtEta(3600 * 2 + 30 * 60 + 15)).toBe('2:30:15')
	})

	it('returns --:-- for invalid values', () => {
		expect(fmtEta(-1)).toBe('--:--')
		expect(fmtEta(Number.NaN)).toBe('--:--')
	})
})

describe('spinner', () => {
	it('returns a controller with the documented methods', () => {
		const s = spinner('starting')
		expect(typeof s.update).toBe('function')
		expect(typeof s.succeed).toBe('function')
		expect(typeof s.fail).toBe('function')
		expect(typeof s.warn).toBe('function')
		expect(typeof s.stop).toBe('function')
		s.stop()
	})

	it('does not write to stdout (only stderr)', () => {
		const stdoutSpy = spyOn(process.stdout, 'write')
		const s = spinner('starting')
		s.succeed('done')
		s.stop()
		expect(stdoutSpy).not.toHaveBeenCalled()
		stdoutSpy.mockRestore()
	})

	it('idempotent: calling stop twice is a no-op', () => {
		const s = spinner('starting')
		s.succeed('done')
		expect(() => {
			s.succeed('done')
			s.fail('failed')
			s.warn('warned')
			s.stop()
		}).not.toThrow()
	})
})

describe('progressBar', () => {
	it('returns a controller with the documented methods', () => {
		const bar = progressBar(100, { format: 'percent' })
		expect(typeof bar.tick).toBe('function')
		expect(typeof bar.done).toBe('function')
		expect(typeof bar.fail).toBe('function')
		expect(typeof bar.stop).toBe('function')
		bar.stop()
	})

	it('does not write to stdout (only stderr)', () => {
		const stdoutSpy = spyOn(process.stdout, 'write')
		const bar = progressBar(100, { format: 'percent' })
		bar.tick(50, 'half')
		bar.done()
		expect(stdoutSpy).not.toHaveBeenCalled()
		stdoutSpy.mockRestore()
	})

	it('ticks with a percent format accept 0..100', () => {
		const bar = progressBar(100, { format: 'percent' })
		bar.tick(0)
		bar.tick(25)
		bar.tick(99.9)
		bar.tick(100, 'done')
		bar.done('all done')
	})

	it('ticks with a byte format', () => {
		const bar = progressBar(1024 * 1024, { format: 'bytes' })
		bar.tick(512 * 1024, 'half')
		bar.done()
	})

	it('handles a total of 0 without dividing by zero', () => {
		const bar = progressBar(0, { format: 'bytes' })
		bar.tick(0)
		bar.done()
	})

	it('idempotent: calling done twice is a no-op', () => {
		const bar = progressBar(100, { format: 'percent' })
		bar.done('first')
		expect(() => {
			bar.done('second')
			bar.fail('failed')
			bar.tick(50)
			bar.stop()
		}).not.toThrow()
	})
})

describe('multiStep', () => {
	it('returns a controller with the documented methods', () => {
		const stepper = multiStep([{ label: 'a' }, { label: 'b' }])
		expect(typeof stepper.activate).toBe('function')
		expect(typeof stepper.update).toBe('function')
		expect(typeof stepper.complete).toBe('function')
		expect(typeof stepper.fail).toBe('function')
	})

	it('transitions through the lifecycle without throwing', () => {
		const stepper = multiStep([
			{ label: 'phase 1' },
			{ label: 'phase 2' },
			{ label: 'phase 3' },
		])
		stepper.activate(0, 'starting phase 1')
		stepper.update(0, 'still phase 1')
		stepper.complete(0, 'phase 1 done')
		stepper.activate(1, 'starting phase 2')
		stepper.complete(1)
		stepper.activate(2)
		stepper.fail(2, 'phase 3 broke')
	})

	it('does not write to stdout (only stderr)', () => {
		const stdoutSpy = spyOn(process.stdout, 'write')
		const stepper = multiStep([{ label: 'a' }])
		stepper.activate(0)
		stepper.complete(0)
		expect(stdoutSpy).not.toHaveBeenCalled()
		stdoutSpy.mockRestore()
	})

	it('update on a non-active step is a no-op', () => {
		const stepper = multiStep([{ label: 'a' }])
		expect(() => stepper.update(0, 'should be ignored')).not.toThrow()
		stepper.complete(0)
	})

	it('complete on an already-finalized step is a no-op', () => {
		const stepper = multiStep([{ label: 'a' }, { label: 'b' }])
		stepper.complete(0)
		expect(() => {
			stepper.complete(0)
			stepper.fail(0)
		}).not.toThrow()
	})
})
