// Unit tests for the WakeListener and its energy fallback detector.

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
	EnergyWakeDetector,
	MockWakeDetector,
	WakeListener,
	setRecordingFactory,
} from './listener.ts'

describe('WakeListener', () => {
	let listener: WakeListener

	beforeEach(() => {
		listener = new WakeListener({ keyword: 'omni' })
	})

	afterEach(() => {
		listener.stop()
	})

	it('starts in idle state', () => {
		expect(listener.getState()).toBe('idle')
		expect(listener.getKeyword()).toBe('omni')
	})

	it('emits wake events on loud frames', () => {
		const events: { keyword: string; confidence: number }[] = []
		listener.on('wake', (ev) =>
			events.push(ev as { keyword: string; confidence: number }),
		)

		// Six frames of sustained loudness → energy detector fires.
		const frame = new Float32Array(1600).fill(0.5)
		for (let i = 0; i < 8; i++) {
			listener.handleFrame(frame, 16000)
		}
		expect(events.length).toBe(1)
		expect(events[0]?.keyword).toBe('omni')
		expect((events[0]?.confidence ?? 0) > 0).toBe(true)
	})

	it('respects cooldown between wakes', () => {
		const events: unknown[] = []
		listener.on('wake', (ev) => events.push(ev))
		const loud = new Float32Array(1600).fill(0.5)
		for (let i = 0; i < 8; i++) listener.handleFrame(loud, 16000)
		// Cooldown should suppress the second burst immediately.
		for (let i = 0; i < 8; i++) listener.handleFrame(loud, 16000)
		expect(events.length).toBe(1)
	})

	it('ignores quiet frames', () => {
		const events: unknown[] = []
		listener.on('wake', (ev) => events.push(ev))
		const quiet = new Float32Array(1600).fill(0.01)
		for (let i = 0; i < 20; i++) listener.handleFrame(quiet, 16000)
		expect(events.length).toBe(0)
	})

	it('state transitions: idle → starting → listening on start() with factory', async () => {
		const states: string[] = []
		listener.on('state', (s) => states.push(String(s)))
		setRecordingFactory(async () => ({
			stop() {
				// noop
			},
		}))
		await listener.start()
		expect(states).toContain('starting')
		expect(states).toContain('listening')
		listener.stop()
		expect(states).toContain('idle')
	})

	it('errors when start() is called without a factory', async () => {
		// Use a sub-listener to make the failure deterministic. The global
		// factory is unset via a helper that the test files can call.
		const { unsetRecordingFactory } = await import('./listener.ts')
		unsetRecordingFactory()
		const l = new WakeListener()
		const errors: Error[] = []
		l.on('error', (e) => errors.push(e as Error))
		await expect(l.start()).rejects.toThrow()
		expect(errors.length).toBe(1)
		expect(l.getState()).toBe('error')
	})

	it('unsubscribe removes the listener', () => {
		const events: unknown[] = []
		const unsub = listener.on('wake', (e) => events.push(e))
		unsub()
		const loud = new Float32Array(1600).fill(0.5)
		for (let i = 0; i < 8; i++) listener.handleFrame(loud, 16000)
		expect(events.length).toBe(0)
	})
})

describe('EnergyWakeDetector', () => {
	it('uses energy backend', () => {
		const d = new EnergyWakeDetector('omni')
		expect(d.backend).toBe('energy')
		expect(d.keyword).toBe('omni')
	})

	it('resets state', () => {
		const d = new EnergyWakeDetector('omni')
		d.pushFrame(new Float32Array(1600).fill(0.5), 16000)
		d.reset()
		expect(d.pushFrame(new Float32Array(0), 16000)).toBeNull()
	})
})

describe('MockWakeDetector', () => {
	it('uses mock backend and never fires', () => {
		const d = new MockWakeDetector('omni')
		expect(d.backend).toBe('mock')
		const loud = new Float32Array(1600).fill(0.5)
		expect(d.pushFrame(loud, 16000)).toBeNull()
	})
})
