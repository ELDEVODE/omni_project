import { useState } from 'react'
import { api } from '../lib/api.ts'

export function VideoGenPanel() {
	const [prompt, setPrompt] = useState('a rocket launching')
	const [progress, setProgress] = useState<number>(0)
	const [result, setResult] = useState<{ url?: string; b64_json?: string } | null>(null)
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')

	const run = async () => {
		if (!prompt.trim()) return
		setRunning(true)
		setError('')
		setProgress(0)
		setResult(null)
		try {
			setProgress(0.5)
			const res = await api.images('llama-3.2-1b', prompt, 1, '1024x1024')
			setProgress(1)
			if (res.data?.[0]) {
				setResult(res.data[0])
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
				Image generation via /v1/images/generations. (Video gen not available —
				using image gen as stand-in.)
			</p>
			<div style={{ display: 'flex', gap: 8 }}>
				<input
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && run()}
					placeholder="Describe the scene…"
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
					disabled={running || !prompt.trim()}
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
					{running ? 'GENERATING…' : '▶ GENERATE'}
				</button>
			</div>
			{(running || progress > 0) && (
				<div
					style={{
						marginTop: 12,
						height: 4,
						background: 'rgba(0,20,40,0.6)',
						border: '1px solid rgba(0,212,255,0.2)',
						borderRadius: 2,
						overflow: 'hidden',
					}}
				>
					<div
						style={{
							width: `${Math.round(progress * 100)}%`,
							height: '100%',
							background: 'var(--cyan)',
							transition: 'width 0.2s',
						}}
					/>
				</div>
			)}
			{error && (
				<div style={{ color: '#ff6a00', marginTop: 8, fontSize: 11 }}>
					⚠ {error}
				</div>
			)}
			{result?.b64_json && (
				<img
					src={`data:image/png;base64,${result.b64_json}`}
					alt={prompt}
					style={{ maxWidth: '100%', marginTop: 12, display: 'block' }}
				/>
			)}
		</div>
	)
}
