// OpenAIPanel — surfaces the OpenAI-compat endpoint the host exposes
// on port 11434 (matching Ollama's port). Provides a copy-paste curl
// snippet and a test request button.

import { useEffect, useState } from 'react'
import { Elapsed, Spinner } from '../components/Progress.tsx'
import { SERVER_URL, loadAuthToken } from '../lib/api.ts'

type Model = { id: string; object: string }

export function OpenAIPanel() {
	const [models, setModels] = useState<Model[]>([])
	const [error, setError] = useState('')
	const [reply, setReply] = useState('')
	const [busy, setBusy] = useState(false)
	const [loadingModels, setLoadingModels] = useState(true)
	const [startedAt, setStartedAt] = useState(0)
	const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null)
	const [prompt, setPrompt] = useState('Say hello to the OmniMesh mesh.')

	const baseUrl = SERVER_URL.replace(':3005', ':11434')

	const refresh = async () => {
		setLoadingModels(true)
		try {
			const r = await fetch(`${baseUrl}/v1/models`)
			if (!r.ok) throw new Error(`HTTP ${r.status}`)
			const j = (await r.json()) as { data: Model[] }
			setModels(j.data)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setLoadingModels(false)
		}
	}

	useEffect(() => {
		void refresh()
	}, [])

	const testRequest = async () => {
		setStartedAt(Date.now())
		setFirstTokenMs(null)
		setBusy(true)
		setReply('')
		try {
			const r = await fetch(`${baseUrl}/v1/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: models[0]?.id,
					messages: [{ role: 'user', content: prompt }],
					stream: true,
				}),
			})
			if (!r.body) {
				setReply('(no body)')
				return
			}
			const reader = r.body.getReader()
			const decoder = new TextDecoder()
			let buf = ''
			while (true) {
				const { value, done } = await reader.read()
				if (done) break
				buf += decoder.decode(value, { stream: true })
				setReply(buf)
				if (firstTokenMs === null) {
					setFirstTokenMs(Date.now() - startedAt)
				}
			}
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setBusy(false)
		}
	}

	const token = loadAuthToken()
	const curl = `curl ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  ${token ? `-H "Authorization: Bearer ${token}" \\\\\n  ` : ''}-d '{
  "model": "${models[0]?.id ?? 'llama-3.1-8b-instruct-q4'}",
  "messages": [{"role": "user", "content": "Hello!"}]
}'`

	return (
		<div
			style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
		>
			<h2 style={{ margin: 0, color: 'var(--cyan)' }}>
				OPENAI-COMPAT ENDPOINT
			</h2>
			<div
				style={{
					padding: 12,
					background: 'rgba(0,20,40,0.4)',
					border: '1px solid rgba(0,212,255,0.2)',
					borderRadius: 4,
				}}
			>
				<div
					style={{
						fontSize: 10,
						opacity: 0.7,
						color: 'var(--green)',
						marginBottom: 4,
					}}
				>
					ENDPOINT
				</div>
				<div
					style={{
						fontFamily: 'monospace',
						fontSize: 12,
						color: 'var(--cyan)',
					}}
				>
					{baseUrl}/v1/chat/completions
				</div>
				<div
					style={{
						fontSize: 10,
						opacity: 0.7,
						marginTop: 8,
						color: 'var(--green)',
					}}
				>
					MODELS
				</div>
				<div
					style={{
						fontSize: 11,
						fontFamily: 'monospace',
						display: 'flex',
						alignItems: 'center',
						gap: 8,
					}}
				>
					{loadingModels ? <Spinner size={9} /> : null}
					{models.length === 0
						? '(none registered)'
						: models.map((m) => m.id).join(', ')}
				</div>
			</div>

			<div
				style={{
					padding: 12,
					background: 'rgba(0,20,40,0.4)',
					border: '1px solid rgba(0,212,255,0.15)',
					borderRadius: 4,
				}}
			>
				<div
					style={{
						fontSize: 10,
						opacity: 0.7,
						color: 'var(--green)',
						marginBottom: 6,
					}}
				>
					CURL
				</div>
				<pre
					style={{
						fontFamily: 'monospace',
						fontSize: 10,
						whiteSpace: 'pre-wrap',
						margin: 0,
						opacity: 0.85,
					}}
				>
					{curl}
				</pre>
			</div>

			<div
				style={{
					padding: 12,
					background: 'rgba(0,20,40,0.4)',
					border: '1px solid rgba(0,212,255,0.15)',
					borderRadius: 4,
				}}
			>
				<div
					style={{
						fontSize: 10,
						opacity: 0.7,
						color: 'var(--green)',
						marginBottom: 6,
					}}
				>
					TEST FROM DASHBOARD
				</div>
				<textarea
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					rows={3}
					style={{
						width: '100%',
						background: 'rgba(0,10,20,0.6)',
						border: '1px solid rgba(0,212,255,0.2)',
						color: 'var(--green)',
						padding: 6,
						fontFamily: 'monospace',
						fontSize: 11,
					}}
				/>
				<button
					type="button"
					onClick={() => void testRequest()}
					disabled={busy}
					style={{
						marginTop: 8,
						padding: '6px 12px',
						background: 'rgba(0,212,255,0.15)',
						border: '1px solid var(--cyan)',
						color: 'var(--cyan)',
						cursor: 'pointer',
						fontSize: 11,
						display: 'inline-flex',
						alignItems: 'center',
						gap: 8,
					}}
				>
					{busy ? <Spinner size={10} /> : null}
					{busy ? 'streaming' : 'POST /v1/chat/completions'}
				</button>
				{busy && startedAt > 0 ? <Elapsed from={startedAt} /> : null}
				{firstTokenMs !== null ? (
					<span
						style={{
							fontFamily: 'monospace',
							fontSize: 10,
							color: 'var(--green)',
						}}
					>
						first token in {firstTokenMs}ms
					</span>
				) : null}
				{reply && (
					<pre
						style={{
							marginTop: 8,
							padding: 6,
							background: 'rgba(0,10,20,0.6)',
							border: '1px solid rgba(0,212,255,0.1)',
							fontFamily: 'monospace',
							fontSize: 10,
							whiteSpace: 'pre-wrap',
							color: 'var(--green)',
						}}
					>
						{reply}
					</pre>
				)}
			</div>

			{error && (
				<div style={{ color: 'var(--red)', fontSize: 11 }}>⚠ {error}</div>
			)}
		</div>
	)
}
