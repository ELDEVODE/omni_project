// Inference client. Speaks the host's /api/infer and /api/cap/* endpoints
// over HTTP. The phone can either run inference locally (via @qvac/sdk)
// or delegate to a worker over the mesh — this module handles delegation.

export type InferRequest = {
	modelId: string
	input: unknown
	stream?: boolean
	nodeId?: string
}

export type InferEvent =
	| { type: 'delta'; delta: unknown }
	| { type: 'done'; result?: unknown; usage?: unknown }
	| { type: 'error'; error: string }

export type CapabilityInput = Record<string, unknown>

export type CapabilityClient = {
	baseUrl: string
	token: string
}

export class MeshInference {
	constructor(private client: CapabilityClient) {}

	baseHeaders(): Record<string, string> {
		return this.client.token
			? { Authorization: `Bearer ${this.client.token}` }
			: {}
	}

	async infer(
		req: InferRequest,
		onEvent: (e: InferEvent) => void,
		signal?: AbortSignal,
	): Promise<void> {
		const res = await fetch(`${this.client.baseUrl}/api/infer`, {
			method: 'POST',
			headers: {
				...this.baseHeaders(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ ...req, stream: req.stream ?? true }),
			signal,
		})
		if (!res.ok || !res.body) {
			onEvent({ type: 'error', error: `HTTP ${res.status}` })
			return
		}
		await readSse(res.body, onEvent)
	}

	async capability(
		name: string,
		input: CapabilityInput,
		onEvent: (e: InferEvent) => void,
		signal?: AbortSignal,
	): Promise<void> {
		const res = await fetch(`${this.client.baseUrl}/api/cap/${name}`, {
			method: 'POST',
			headers: {
				...this.baseHeaders(),
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(input),
			signal,
		})
		if (!res.ok || !res.body) {
			onEvent({ type: 'error', error: `HTTP ${res.status}` })
			return
		}
		await readSse(res.body, onEvent)
	}
}

async function readSse(
	body: ReadableStream<Uint8Array>,
	onEvent: (e: InferEvent) => void,
): Promise<void> {
	const reader = body.getReader()
	const decoder = new TextDecoder()
	let buf = ''
	for (;;) {
		const { value, done } = await reader.read()
		if (done) break
		buf += decoder.decode(value, { stream: true })
		const lines = buf.split('\n')
		buf = lines.pop() ?? ''
		for (const line of lines) {
			if (!line.startsWith('data: ')) continue
			const payload = line.slice(6).trim()
			if (payload === '[DONE]') return
			try {
				const parsed = JSON.parse(payload) as Record<string, unknown>
				if ('delta' in parsed) onEvent({ type: 'delta', delta: parsed.delta })
				else if ('done' in parsed)
					onEvent({ type: 'done', result: parsed.result, usage: parsed.usage })
				else if ('error' in parsed)
					onEvent({ type: 'error', error: String(parsed.error) })
			} catch {
				// ignore malformed
			}
		}
	}
}
