import { useCallback, useRef, useState } from 'react'
import { loadAuthToken } from '@/lib/api'
import { api, type ChatCompletionChunk } from '@/lib/api'

export type ChatMessage = {
	role: 'user' | 'assistant' | 'system'
	content: string
}

export type UseQVACChatReturn = {
	send: (messages: ChatMessage[], model: string, onToken: (token: string) => void) => Promise<void>
	abort: () => void
	loading: boolean
	error: string | null
}

export function useQVACChat(): UseQVACChatReturn {
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const controllerRef = useRef<AbortController | null>(null)

	const send = useCallback(
		async (messages: ChatMessage[], model: string, onToken: (token: string) => void) => {
			setLoading(true)
			setError(null)
			controllerRef.current = new AbortController()

			try {
				const token = loadAuthToken()
				const headers = new Headers({ 'Content-Type': 'application/json' })
				if (token) headers.set('Authorization', `Bearer ${token}`)

				const res = await fetch(`${import.meta.env.VITE_HOST_URL ?? ''}/v1/chat/completions`, {
					method: 'POST',
					headers,
					body: JSON.stringify({
						model,
						messages,
						stream: true,
						temperature: 0.7,
						max_tokens: 2048,
					}),
					signal: controllerRef.current.signal,
				})

				if (!res.ok || !res.body) {
					const text = await res.text().catch(() => '')
					throw new Error(`HTTP ${res.status}: ${text}`)
				}

				const reader = res.body.getReader()
				const decoder = new TextDecoder()
				let buf = ''

				while (true) {
					const { value, done } = await reader.read()
					if (done) break
					buf += decoder.decode(value, { stream: true })
					const lines = buf.split('\n')
					buf = lines.pop() ?? ''
					for (const line of lines) {
						if (!line.startsWith('data: ')) continue
						const raw = line.slice(6).trim()
						if (raw === '[DONE]') return
						try {
							const chunk = JSON.parse(raw) as ChatCompletionChunk
							const delta = chunk.choices?.[0]?.delta?.content
							if (delta) onToken(delta)
						} catch {
						}
					}
				}
			} catch (err) {
				if ((err as Error).name !== 'AbortError') {
					setError((err as Error).message)
				}
			} finally {
				setLoading(false)
			}
		},
		[],
	)

	const abort = useCallback(() => {
		controllerRef.current?.abort()
		setLoading(false)
	}, [])

	return { send, abort, loading, error }
}

export function useQVACModels() {
	const [models, setModels] = useState<Array<{ id: string; object: 'model' }>>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const data = await api.models()
			setModels(data.data)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setLoading(false)
		}
	}, [])

	return { models, loading, error, load }
}