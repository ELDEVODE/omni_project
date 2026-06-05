// Captures a single utterance (Int16 PCM at 16kHz mono) from the
// recording factory registered via setRecordingFactory. Production
// wiring reuses the expo-av-backed recorder so the wake-listener mic
// and the capture mic share the same audio session.

import {
	type Recording,
	type RecordingOptions,
	setRecordingFactory,
} from './listener.ts'

export function setCaptureFactory(
	factory: (opts: RecordingOptions) => Promise<Recording>,
): void {
	setRecordingFactory(factory)
}

export async function captureUtterance(
	maxMs: number,
	signal: AbortSignal,
): Promise<{ samples: Int16Array; sampleRate: number } | null> {
	let factory: ((opts: RecordingOptions) => Promise<Recording>) | null = null
	try {
		const mod = (await import('./listener.ts')) as {
			_recordingFactory?: (opts: RecordingOptions) => Promise<Recording>
		}
		factory = mod._recordingFactory ?? null
	} catch {
		factory = null
	}
	if (!factory) {
		throw new Error(
			'No capture factory registered. Call setCaptureFactory() before start().',
		)
	}
	const sampleRate = 16000
	const chunks: Int16Array[] = []
	let cancelled = false
	let stopped = false
	let resolveOuter:
		| ((v: { samples: Int16Array; sampleRate: number } | null) => void)
		| null = null

	const finish = () => {
		if (stopped) return
		stopped = true
		if (cancelled) {
			resolveOuter?.(null)
			return
		}
		const total = chunks.reduce((n, c) => n + c.length, 0)
		const out = new Int16Array(total)
		let off = 0
		for (const c of chunks) {
			out.set(c, off)
			off += c.length
		}
		resolveOuter?.({ samples: out, sampleRate })
	}

	const onAbort = () => {
		cancelled = true
		finish()
	}
	if (signal.aborted) return null
	signal.addEventListener('abort', onAbort, { once: true })

	const startedAt = Date.now()
	const promise = new Promise<{
		samples: Int16Array
		sampleRate: number
	} | null>((res) => {
		resolveOuter = res
	})

	let rec: Recording | null = null
	try {
		rec = await factory({
			sampleRate,
			frameMs: 100,
			onFrame: (samples) => {
				if (cancelled || stopped) return
				const pcm = new Int16Array(samples.length)
				for (let i = 0; i < samples.length; i++) {
					const v = samples[i] ?? 0
					pcm[i] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)))
				}
				chunks.push(pcm)
				if (Date.now() - startedAt >= maxMs) {
					rec?.stop()
					finish()
				}
			},
			onError: () => {
				resolveOuter?.(null)
			},
		})
	} catch {
		signal.removeEventListener('abort', onAbort)
		return null
	}

	// Safety net: if the factory never reaches the maxMs threshold (e.g.
	// a quiet mic), fall back to a hard timeout slightly longer than the
	// capture window so the pipeline never hangs.
	const timer = setTimeout(() => {
		rec?.stop()
		finish()
	}, maxMs + 250)
	if (typeof (timer as { unref?: () => void }).unref === 'function') {
		;(timer as { unref?: () => void }).unref?.()
	}

	return promise
}
