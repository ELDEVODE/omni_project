import { useState } from 'react'
import { api } from '../lib/api.ts'

type Score = { label: string; score: number }

export function ClassifyPanel() {
	const [text, setText] = useState(
		'I love programming in TypeScript and building AI systems',
	)
	const [categories, setCategories] = useState(
		'technology, sports, politics, entertainment, science',
	)
	const [scores, setScores] = useState<Score[] | null>(null)
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')

	const run = async () => {
		if (!text.trim()) return
		setRunning(true)
		setError('')
		setScores(null)
		try {
			const system = `You are a zero-shot classifier. Classify the given text into the following categories: ${categories}. Return ONLY a JSON array of objects with "label" and "score" (0-1) keys, sorted by score descending. Do not include any other text.`
			const res = await api.chat({
				model: 'llama-3.2-1b',
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: text },
				],
				temperature: 0,
				max_tokens: 256,
			})
			const body = typeof res === 'object' && 'choices' in res ? res : null
			if (body?.choices?.[0]?.message?.content) {
				const parsed = JSON.parse(body.choices[0].message.content) as Score[]
				if (Array.isArray(parsed)) setScores(parsed)
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
				Zero-shot text classification via LLM prompt. Returns ranked labels.
			</p>
			<textarea
				value={text}
				onChange={(e) => setText(e.target.value)}
				rows={3}
				style={{
					width: '100%',
					background: 'rgba(0,20,40,0.4)',
					border: '1px solid var(--border)',
					color: 'var(--text-bright)',
					padding: 8,
					borderRadius: 4,
					fontSize: 13,
				}}
			/>
			<label
				htmlFor="categories"
				className="hud-label"
				style={{ display: 'block', marginTop: 8, fontSize: 10, opacity: 0.6 }}
			>
				Categories (comma-separated)
			</label>
			<input
				id="categories"
				value={categories}
				onChange={(e) => setCategories(e.target.value)}
				style={{
					width: '100%',
					marginTop: 4,
					background: 'rgba(0,20,40,0.4)',
					border: '1px solid var(--border)',
					color: 'var(--text-bright)',
					padding: '6px 8px',
					borderRadius: 4,
					fontSize: 12,
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
					cursor: 'pointer',
					borderRadius: 4,
				}}
			>
				{running ? 'CLASSIFYING…' : '▶ CLASSIFY'}
			</button>
			{error && (
				<div style={{ color: '#ff6a00', marginTop: 8, fontSize: 11 }}>
					⚠ {error}
				</div>
			)}
			{scores && (
				<div style={{ marginTop: 12 }}>
					{scores.map((s) => (
						<div key={s.label} style={{ marginBottom: 6 }}>
							<div
								style={{
									display: 'flex',
									justifyContent: 'space-between',
									fontSize: 11,
									marginBottom: 2,
								}}
							>
								<span style={{ color: 'var(--text-bright)' }}>{s.label}</span>
								<span className="hud-label" style={{ color: 'var(--cyan)' }}>
									{(s.score * 100).toFixed(0)}%
								</span>
							</div>
							<div
								style={{
									height: 4,
									background: 'rgba(0,20,40,0.6)',
									border: '1px solid rgba(0,212,255,0.1)',
									borderRadius: 2,
									overflow: 'hidden',
								}}
							>
								<div
									style={{
										width: `${s.score * 100}%`,
										height: '100%',
										background: 'var(--cyan)',
									}}
								/>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
