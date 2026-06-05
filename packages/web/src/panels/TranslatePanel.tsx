import { useRef, useState } from 'react'
import { Elapsed, Spinner } from '../components/Progress.tsx'
import { api } from '../lib/api.ts'

const LANGS = [
	{ code: 'es', name: 'Spanish' },
	{ code: 'fr', name: 'French' },
	{ code: 'de', name: 'German' },
	{ code: 'ja', name: 'Japanese' },
	{ code: 'zh', name: 'Chinese' },
	{ code: 'ar', name: 'Arabic' },
	{ code: 'hi', name: 'Hindi' },
	{ code: 'pt', name: 'Portuguese' },
	{ code: 'ru', name: 'Russian' },
	{ code: 'sw', name: 'Swahili' },
]

export function TranslatePanel() {
	const [text, setText] = useState('Hello, how are you?')
	const [target, setTarget] = useState('es')
	const [output, setOutput] = useState('')
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')
	const startedAtRef = useRef<number>(0)
	const [startedAt, setStartedAt] = useState<number>(0)

	const run = async () => {
		if (!text.trim()) return
		startedAtRef.current = Date.now()
		setStartedAt(startedAtRef.current)
		setRunning(true)
		setError('')
		setOutput('')
		try {
			const langName = LANGS.find((l) => l.code === target)?.name ?? target
			const system = `You are a translator. Translate the following text to ${langName} (${target}). Return ONLY the translated text, no explanation.`
			const res = await api.chat({
				model: 'llama-3.2-1b',
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: text },
				],
				temperature: 0.1,
				max_tokens: 512,
			})
			const body = typeof res === 'object' && 'choices' in res ? res : null
			if (body?.choices?.[0]?.message?.content) {
				setOutput(body.choices[0].message.content)
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
				Translation via LLM prompt. Supports multiple target languages.
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
			<div
				style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}
			>
				<span className="hud-label" style={{ fontSize: 10 }}>
					→
				</span>
				<select
					value={target}
					onChange={(e) => setTarget(e.target.value)}
					style={{
						background: 'rgba(0,20,40,0.4)',
						border: '1px solid var(--border)',
						color: 'var(--text-bright)',
						padding: '6px 8px',
						borderRadius: 4,
						fontSize: 12,
					}}
				>
					{LANGS.map((l) => (
						<option key={l.code} value={l.code}>
							{l.name} ({l.code})
						</option>
					))}
				</select>
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
						display: 'inline-flex',
						alignItems: 'center',
						gap: 8,
					}}
				>
					{running ? <Spinner size={11} /> : '▶ TRANSLATE'}
					{running ? 'TRANSLATING' : ''}
				</button>
				{running && startedAt > 0 ? <Elapsed from={startedAt} /> : null}
			</div>
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
						fontSize: 14,
						lineHeight: 1.6,
					}}
				>
					{output}
				</div>
			)}
		</div>
	)
}
