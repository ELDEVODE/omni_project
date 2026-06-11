const HOST_URL: string =
	(import.meta.env.VITE_HOST_URL as string | undefined) ?? ''

export const SERVER_URL = HOST_URL
const OPENAI_URL = '/v1'

let bearerToken: string | null = null

function syncFromQuery(): void {
	if (typeof window === 'undefined') return
	const params = new URLSearchParams(window.location.search)
	const t = params.get('token')
	if (t) {
		bearerToken = t
		localStorage.setItem('omni.secret', t)
	}
}
syncFromQuery()

export function setAuthToken(token: string | null): void {
	bearerToken = token
	if (token) localStorage.setItem('omni.secret', token)
	else localStorage.removeItem('omni.secret')
}

export function loadAuthToken(): string | null {
	if (bearerToken) return bearerToken
	const stored = localStorage.getItem('omni.secret')
	if (stored) bearerToken = stored
	return bearerToken
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
	const headers = new Headers(init.headers)
	if (
		!headers.has('Content-Type') &&
		init.body &&
		typeof init.body === 'string'
	) {
		headers.set('Content-Type', 'application/json')
	}
	const token = loadAuthToken()
	if (token) headers.set('Authorization', `Bearer ${token}`)
	const res = await fetch(`${OPENAI_URL}${path}`, { ...init, headers })
	if (res.status === 401) throw new Error('unauthorized')
	if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
	return res.json() as Promise<T>
}

export interface HealthResponse {
	ok: boolean
	service: string
	qvac: {
		provider: boolean
		publicKey: string
		loadedModels: string[]
	}
}

export interface ModelsResponse {
	object: 'list'
	data: Array<{
		id: string
		object: 'model'
		created: number
		owned_by: string
	}>
}

export interface ChatCompletionChunk {
	id: string
	object: 'chat.completion.chunk'
	created: number
	model: string
	choices: Array<{
		index: number
		delta: { content?: string; role?: string }
		finish_reason: string | null
	}>
}

export interface ChatCompletionResponse {
	id: string
	object: 'chat.completion'
	created: number
	model: string
	choices: Array<{
		index: number
		message: { role: 'assistant'; content: string }
		finish_reason: string
	}>
	usage: {
		prompt_tokens: number
		completion_tokens: number
		total_tokens: number
	}
}

export interface TranscriptionResponse {
	text: string
}

export interface SpeechResponse {
	audio: ArrayBuffer
}

export interface EmbeddingsResponse {
	object: 'list'
	data: Array<{ object: 'embedding'; index: number; embedding: number[] }>
	model: string
	usage: { prompt_tokens: number; total_tokens: number }
}

export interface ImageGenerationResponse {
	created: number
	data: Array<{ url?: string; b64_json?: string }>
}

export const api = {
	health: () => request<HealthResponse>('/health'),
	models: () => request<ModelsResponse>('/models'),
	chat: (body: {
		model: string
		messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
		stream?: boolean
		temperature?: number
		max_tokens?: number
	}) =>
		request<ChatCompletionResponse | ReadableStream>('/chat/completions', {
			method: 'POST',
			body: JSON.stringify(body),
		}),
	transcribe: async (audioBlob: Blob, model: string): Promise<string> => {
		const form = new FormData()
		form.append('file', audioBlob)
		form.append('model', model)
		const token = loadAuthToken()
		const headers = new Headers()
		if (token) headers.set('Authorization', `Bearer ${token}`)
		const res = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
			method: 'POST',
			headers,
			body: form,
		})
		if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
		const data = await res.json()
		return data.text
	},
	speech: async (
		model: string,
		input: string,
		voice: string,
	): Promise<ArrayBuffer> => {
		const token = loadAuthToken()
		const headers = new Headers({ 'Content-Type': 'application/json' })
		if (token) headers.set('Authorization', `Bearer ${token}`)
		const res = await fetch(`${OPENAI_URL}/audio/speech`, {
			method: 'POST',
			headers,
			body: JSON.stringify({ model, input, voice }),
		})
		if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
		return res.arrayBuffer()
	},
	embeddings: (model: string, input: string | string[]) =>
		request<EmbeddingsResponse>('/embeddings', {
			method: 'POST',
			body: JSON.stringify({ model, input }),
		}),
	images: (model: string, prompt: string, n?: number, size?: string) =>
		request<ImageGenerationResponse>('/images/generations', {
			method: 'POST',
			body: JSON.stringify({ model, prompt, n, size }),
		}),
}
