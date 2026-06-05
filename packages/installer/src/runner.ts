// Serial install queue. The runner guarantees one install at a
// time per node, so the same node never has two `bun add` racing
// against its own bun.lock. Cancellation works by aborting the
// in-flight install via the AbortSignal plumbed through the
// InstallContext.

import { type InstallerRegistry, defaultRegistry } from './registry.ts'
import type { Capability, InstallContext, InstallEvent } from './types.ts'

export type RunStatus = 'queued' | 'running' | 'done' | 'fail' | 'cancel'

export type RunState = {
	installId: string
	capability: string
	status: RunStatus
	percent: number
	message: string
	version?: string
	error?: string
	startedAt: number
	finishedAt?: number
	events: InstallEvent[]
}

export type RunnerListener = (state: RunState, event: InstallEvent) => void

type QueueItem = {
	installId: string
	capability: string
	ctx: InstallContext
	controller: AbortController
}

export class InstallRunner {
	private queue: QueueItem[] = []
	private states = new Map<string, RunState>()
	private listeners = new Set<RunnerListener>()
	private nextId = 1
	private active: QueueItem | null = null
	private registry: InstallerRegistry

	constructor(registry: InstallerRegistry = defaultRegistry) {
		this.registry = registry
	}

	list(): RunState[] {
		return [...this.states.values()]
	}

	get(installId: string): RunState | undefined {
		return this.states.get(installId)
	}

	listen(fn: RunnerListener): () => void {
		this.listeners.add(fn)
		return () => this.listeners.delete(fn)
	}

	enqueue(capability: string, ctx: Partial<InstallContext> = {}): RunState {
		const installId = `inst-${this.nextId++}`
		const controller = new AbortController()
		const fullCtx: InstallContext = {
			platform: ctx.platform ?? 'linux',
			cwd: ctx.cwd ?? process.cwd(),
			dryRun: ctx.dryRun ?? false,
			yes: ctx.yes ?? false,
			abortSignal: controller.signal,
			...(ctx.onEvent ? { onEvent: ctx.onEvent } : {}),
		}
		const state: RunState = {
			installId,
			capability,
			status: 'queued',
			percent: 0,
			message: 'queued',
			startedAt: Date.now(),
			events: [],
		}
		this.states.set(installId, state)
		const item: QueueItem = { installId, capability, ctx: fullCtx, controller }
		this.queue.push(item)
		queueMicrotask(() => this.drain())
		return state
	}

	cancel(installId: string): boolean {
		if (this.active?.installId === installId) {
			this.active.controller.abort()
			return true
		}
		const idx = this.queue.findIndex((q) => q.installId === installId)
		if (idx < 0) return false
		const [removed] = this.queue.splice(idx, 1)
		if (!removed) return false
		const state = this.states.get(removed.installId)
		if (state) {
			state.status = 'cancel'
			state.message = 'cancelled before start'
			state.finishedAt = Date.now()
		}
		return true
	}

	private emit(state: RunState, event: InstallEvent): void {
		state.events.push(event)
		for (const fn of this.listeners) {
			try {
				fn(state, event)
			} catch {
				// listeners must not break the runner
			}
		}
	}

	private async drain(): Promise<void> {
		if (this.active) return
		const next = this.queue.shift()
		if (!next) return
		this.active = next
		const state = this.states.get(next.installId)
		if (!state) {
			this.active = null
			void this.drain()
			return
		}
		state.status = 'running'
		state.message = 'starting'
		state.percent = 0
		state.startedAt = Date.now()
		const cap = this.registry.get(next.capability)
		if (!cap) {
			state.status = 'fail'
			state.error = `unknown capability: ${next.capability}`
			state.message = state.error
			state.finishedAt = Date.now()
			this.active = null
			void this.drain()
			return
		}
		this.emit(state, {
			kind: 'start',
			capability: cap.name,
			platform: next.ctx.platform,
		})
		try {
			for await (const ev of cap.install(next.ctx)) {
				state.message = describeEvent(ev)
				if (ev.kind === 'progress') {
					state.percent = ev.percent
				} else if (ev.kind === 'done') {
					state.status = 'done'
					state.version = ev.version
					state.percent = 100
					state.finishedAt = Date.now()
				} else if (ev.kind === 'fail') {
					state.status = 'fail'
					state.error = ev.message
					state.finishedAt = Date.now()
				} else if (ev.kind === 'cancel') {
					state.status = 'cancel'
					state.finishedAt = Date.now()
				}
				this.emit(state, ev)
				if (ev.kind === 'done' || ev.kind === 'fail' || ev.kind === 'cancel')
					break
			}
		} catch (err) {
			state.status = 'fail'
			state.error = (err as Error).message
			state.finishedAt = Date.now()
			this.emit(state, {
				kind: 'fail',
				capability: cap.name,
				code: 'runner_exception',
				message: state.error,
			})
		}
		this.active = null
		void this.drain()
	}
}

function describeEvent(ev: InstallEvent): string {
	if (ev.kind === 'progress') return ev.message
	if (ev.kind === 'done') return `done ${ev.version}`
	if (ev.kind === 'fail') return `fail: ${ev.message}`
	if (ev.kind === 'cancel') return 'cancelled'
	if (ev.kind === 'start') return `start (${ev.platform})`
	return ev.message
}

export type { Capability, InstallContext, InstallEvent }
