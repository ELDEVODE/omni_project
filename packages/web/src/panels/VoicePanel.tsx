import { useState } from 'react'
import { api } from '../lib/api.ts'

export function VoicePanel() {
	const [input, setInput] = useState('What is the meaning of life?')
	const [running, setRunning] = useState(false)
	const [phases, setPhases] = useState<string[]>([])
	const [result, setResult] = useState<{
		transcript: string
		reply: string
	} | null>(null)
	const [error, setError] = useState('')

	const run = async () => {
		if (!input.trim()) return
		setRunning(true)
		setError('')
		setPhases([])
		setResult(null)
		try {
			setPhases((p) => [...p, 'transcribe (simulated ASR)…'])
			const syntheticAudio = new Blob([new Uint8Array(44)], { type: 'audio/wav' })
			let transcript = input
			try {
				transcript = await api.transcribe(syntheticAudio, 'whisper')
			} catch {
				transcript = input
			}
			setPhases((p) => [...p, `transcribed: "${transcript.slice(0, 60)}…"`])

			setPhases((p) => [...p, 'chat (LLM)…'])
			const res = await api.chat({
				model: 'llama-3.2-1b',
				messages: [
					{ role: 'system', content: 'You are a helpful voice assistant. Respond concisely.' },
					{ role: 'user', content: transcript },
				],
				temperature: 0.3,
				max_tokens: 256,
			})
			const body = typeof res === 'object' && 'choices' in res ? res : null
			const reply = body?.choices?.[0]?.message?.content ?? '(no reply)'
			setPhases((p) => [...p, 'speak (TTS)…'])

			try {
				const AudioCtx =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
				const audioCtx = new AudioCtx()
				const audioBuf = await audioCtx.decodeAudioData(
					await api.speech('tts', reply, 'default'),
				)
				const src = audioCtx.createBufferSource()
				src.buffer = audioBuf
				src.connect(audioCtx.destination)
				src.start(0)
			} catch {
				// TTS not available; show reply as text
			}

			setPhases((p) => [...p, 'done'])
			setResult({ transcript, reply })
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setRunning(false)
		}
	}

	return (
		<div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
			<p className="hud-label" style={{ marginBottom: 8, opacity: 0.6 }}>
				Voice pipeline: ASR → LLM → TTS via OpenAI-compat endpoints.
			</p>
			<div style={{ display: 'flex', gap: 8 }}>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && run()}
					placeholder="Ask a question (simulates spoken input)…"
					style={{
						flex: 1,
						background: 'rgba(0,20,40,0.4)',
						border: '1px solid var(--border)',
						color: 'var(--text-bright)',
						padding: '8px 10px',
						borderRadius: 4,
						fontSize: 12,
					}}
				/>
				<button
					onClick={run}
					disabled={running || !input.trim()}
					style={{
						background: 'rgba(0,212,255,0.1)',
						border: '1px solid rgba(0,212,255,0.3)',
						color: 'var(--cyan)',
						padding: '6px 16px',
						fontSize: 11,
						cursor: 'pointer',
						borderRadius: 4,
					}}
				>
					{running ? 'PIPELINE…' : '▶ RUN'}
				</button>
			</div>
			{phases.length > 0 && (
				<div
					style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}
				>
					{phases.map((p, i) => (
						<div key={`voice-phase-${i}-${p}`} style={{ color: 'var(--cyan)' }}>
							→ {p}
						</div>
					))}
				</div>
			)}
			{error && (
				<div style={{ color: '#ff6a00', marginTop: 8, fontSize: 11 }}>
					⚠ {error}
				</div>
			)}
			{result && (
				<div
					style={{
						marginTop: 12,
						padding: 12,
						background: 'rgba(0,212,255,0.04)',
						border: '1px solid rgba(0,212,255,0.2)',
						borderRadius: 4,
					}}
				>
					<div className="hud-label" style={{ fontSize: 10, marginBottom: 4 }}>
						TRANSCRIPT
					</div>
					<div style={{ fontSize: 12, marginBottom: 8 }}>
						{result.transcript}
					</div>
					<div className="hud-label" style={{ fontSize: 10, marginBottom: 4 }}>
						REPLY
					</div>
					<div style={{ fontSize: 13 }}>{result.reply}</div>
				</div>
			)}
		</div>
	)
}
