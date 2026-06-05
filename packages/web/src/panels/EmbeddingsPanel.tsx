import { useState } from 'react'
import { Elapsed, Spinner } from '../components/Progress.tsx'
import { api } from '../lib/api.ts'

export function EmbeddingsPanel() {
	const [input, setInput] = useState('hello world\nfoo bar')
	const [output, setOutput] = useState<{
		dim: number
		count: number
		tokens: number
		first: number[]
	} | null>(null)
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')
	const [startedAt, setStartedAt] = useState(0)
	const [progress, setProgress] = useState<{
		done: number
		total: number
	} | null>(null)

	const run = async () => {
		setStartedAt(Date.now())
		setRunning(true)
		setError('')
		setOutput(null)
		try {
			const texts = input.split('\n').filter((s) => s.trim())
			setProgress({ done: 0, total: texts.length })
			const res = await api.embeddings('embed', texts)
			setProgress({ done: texts.length, total: texts.length })
			if (res.data) {
				const vectors = res.data.map((d) => d.embedding)
				setOutput({
					dim: vectors[0]?.length ?? 0,
					count: vectors.length,
					tokens: res.usage?.prompt_tokens ?? 0,
					first: vectors[0]?.slice(0, 8) ?? [],
				})
			}
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setRunning(false)
			setProgress(null)
		}
	}

	return (
		<div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
			<p className="hud-label" style={{ marginBottom: 8, opacity: 0.6 }}>
				One embedding per line. Returns normalized vectors.
			</p>
			<textarea
				value={input}
				onChange={(e) => setInput(e.target.value)}
				rows={4}
				style={{
					width: '100%',
					background: 'rgba(0,20,40,0.4)',
					border: '1px solid var(--border)',
					color: 'var(--text-bright)',
					padding: 10,
					borderRadius: 4,
					fontSize: 12,
					fontFamily: 'var(--font-body)',
					resize: 'vertical',
				}}
			/>
			<button
				onClick={run}
				disabled={running}
				style={{
					marginTop: 8,
					background: 'rgba(0,212,255,0.1)',
					border: '1px solid rgba(0,212,255,0.3)',
					color: 'var(--cyan)',
					padding: '6px 16px',
					fontSize: 11,
					cursor: running ? 'wait' : 'pointer',
					borderRadius: 4,
					display: 'inline-flex',
					alignItems: 'center',
					gap: 8,
				}}
			>
				{running ? <Spinner size={11} /> : '▶'}
				{running ? 'EMBEDDING' : 'EMBED'}
			</button>
			{running && progress ? (
				<div
					style={{
						marginTop: 8,
						display: 'flex',
						alignItems: 'center',
						gap: 10,
					}}
				>
					<span
						className="hud-label"
						style={{ fontSize: 10, color: 'var(--cyan)' }}
					>
						embedding {progress.done}/{progress.total}
					</span>
					{startedAt > 0 ? <Elapsed from={startedAt} /> : null}
				</div>
			) : null}
			{error && (
				<div style={{ color: '#ff6a00', marginTop: 8, fontSize: 11 }}>
					⚠ {error}
				</div>
			)}
			{output && (
				<div
					style={{
						marginTop: 12,
						padding: 12,
						background: 'rgba(0,212,255,0.04)',
						border: '1px solid rgba(0,212,255,0.2)',
						borderRadius: 4,
					}}
				>
					<div className="hud-label" style={{ marginBottom: 6 }}>
						dim: <span style={{ color: 'var(--cyan)' }}>{output.dim}</span> ·
						count: <span style={{ color: 'var(--cyan)' }}>{output.count}</span>{' '}
						· tokens:{' '}
						<span style={{ color: 'var(--cyan)' }}>{output.tokens}</span>
					</div>
					<div
						style={{
							fontSize: 10,
							opacity: 0.7,
							fontFamily: 'var(--font-mono)',
						}}
					>
						v0[0..7] = [{output.first.map((n) => n.toFixed(3)).join(', ')}]
					</div>
				</div>
			)}
		</div>
	)
}
