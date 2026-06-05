import { useState } from 'react'
import { api } from '../lib/api.ts'

export function SpeakPanel() {
	const [text, setText] = useState(
		'Hello, this is the OmniMesh cluster speaking.',
	)
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')
	const [autoplay, setAutoplay] = useState(true)

	const run = async () => {
		if (!text.trim()) return
		setRunning(true)
		setError('')
		try {
			const buf = await api.speech('tts', text, 'default')
			if (autoplay) {
				const AudioCtx =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
				const audioCtx = new AudioCtx()
				const audioBuf = await audioCtx.decodeAudioData(buf)
				const src = audioCtx.createBufferSource()
				src.buffer = audioBuf
				src.connect(audioCtx.destination)
				src.start(0)
			}
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setRunning(false)
		}
	}

	return (
		<div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
			<p className="hud-label" style={{ marginBottom: 8, opacity: 0.6 }}>
				Text-to-speech via /v1/audio/speech. Returns audio buffer and auto-plays.
			</p>
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				rows={4}
				style={{
					width: '100%',
					background: 'rgba(0,20,40,0.4)',
					border: '1px solid var(--border)',
					color: 'var(--text-bright)',
					padding: 10,
					borderRadius: 4,
					fontSize: 13,
					lineHeight: 1.5,
				}}
			/>
			<div
				style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}
			>
				<button
					onClick={run}
					disabled={running || !text.trim()}
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
					{running ? 'SYNTHESIZING…' : '▶ SPEAK'}
				</button>
				<label
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 4,
						fontSize: 10,
						opacity: 0.7,
					}}
				>
					<input
						type="checkbox"
						checked={autoplay}
						onChange={(e) => setAutoplay(e.target.checked)}
					/>
					autoplay
				</label>
			</div>
			{error && (
				<div style={{ color: '#ff6a00', marginTop: 8, fontSize: 11 }}>
					⚠ {error}
				</div>
			)}
		</div>
	)
}
