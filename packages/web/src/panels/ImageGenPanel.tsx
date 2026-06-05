import { useState } from 'react'
import { Bar, Elapsed, Spinner } from '../components/Progress.tsx'
import { api } from '../lib/api.ts'

type ImgResult = {
	prompt: string
	width: number
	height: number
	format: string
	imageB64?: string
	note?: string
}

export function ImageGenPanel() {
	const [prompt, setPrompt] = useState('a red cat in space, cinematic')
	const [progress, setProgress] = useState<string[]>([])
	const [result, setResult] = useState<ImgResult | null>(null)
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')
	const [startedAt, setStartedAt] = useState(0)

	const run = async () => {
		if (!prompt.trim()) return
		setStartedAt(Date.now())
		setRunning(true)
		setError('')
		setProgress([])
		setResult(null)
		try {
			setProgress((p) => [...p, 'Requesting generation…'])
			const res = await api.images('llama-3.2-1b', prompt, 1, '512x512')
			setProgress((p) => [...p, 'Generation complete'])
			if (res.data?.[0]?.b64_json) {
				setResult({
					prompt,
					width: 512,
					height: 512,
					format: 'png',
					imageB64: res.data[0].b64_json,
					note: 'base64 from /v1/images/generations',
				})
			} else if (res.data?.[0]?.url) {
				setResult({
					prompt,
					width: 512,
					height: 512,
					format: 'png',
					note: `URL: ${res.data[0].url}`,
				})
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
				Text-to-image via /v1/images/generations. Returns base64 PNG or URL.
			</p>
			<div style={{ display: 'flex', gap: 8 }}>
				<input
					value={prompt}
					onChange={(e) => setPrompt(e.target.value)}
					onKeyDown={(e) => e.key === 'Enter' && run()}
					placeholder="Describe the image…"
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
						display: 'inline-flex',
						alignItems: 'center',
						gap: 8,
					}}
				>
					{running ? <Spinner size={11} /> : '▶'}
					{running ? 'GENERATING' : 'GENERATE'}
				</button>
			</div>
			{running ? (
				<div style={{ marginTop: 12 }}>
					<Bar
						percent={null}
						label={progress[progress.length - 1] ?? 'requesting generation…'}
						right={startedAt > 0 ? <Elapsed from={startedAt} /> : null}
					/>
				</div>
			) : null}
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
					{result.imageB64 && (
						<img
							src={`data:image/${result.format};base64,${result.imageB64}`}
							alt={result.prompt}
							style={{ maxWidth: '100%', display: 'block', marginBottom: 8 }}
						/>
					)}
					<div className="hud-label" style={{ fontSize: 9, opacity: 0.7 }}>
						{result.width}×{result.height} · {result.format}{' '}
						{result.note && `· ${result.note}`}
					</div>
				</div>
			)}
		</div>
	)
}
