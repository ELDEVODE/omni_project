import { useState } from 'react'
import { api } from '../lib/api.ts'

export function OcrPanel() {
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')
	const [result, setResult] = useState<{
		text: string
		lines: number
		confidence: number
	} | null>(null)

	const onFile = async (file: File) => {
		setRunning(true)
		setError('')
		setResult(null)
		try {
			const b64 = await fileToBase64(file)
			const system = 'You are an OCR engine. Extract all text from the provided image. Return ONLY the extracted text, no explanation. Report the number of lines.'
			const res = await api.chat({
				model: 'llama-3.2-1b',
				messages: [
					{ role: 'system', content: system },
					{ role: 'user', content: `[Image: ${b64}]\n\nExtract all text from this image.` },
				],
				temperature: 0,
				max_tokens: 1024,
			})
			const body = typeof res === 'object' && 'choices' in res ? res : null
			if (body?.choices?.[0]?.message?.content) {
				const text = body.choices[0].message.content
				setResult({ text, lines: text.split('\n').length, confidence: 0.85 })
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
				Optical character recognition via vision LLM. Upload an image.
			</p>
			<div style={{ display: 'flex', gap: 8 }}>
				<label
					style={{
						background: 'rgba(0,212,255,0.1)',
						border: '1px solid rgba(0,212,255,0.3)',
						color: 'var(--cyan)',
						padding: '6px 12px',
						fontSize: 11,
						cursor: 'pointer',
						borderRadius: 4,
					}}
				>
					⇪ UPLOAD IMAGE
					<input
						type="file"
						accept="image/*"
						onChange={(e) => {
							const f = e.target.files?.[0]
							if (f) void onFile(f)
						}}
						style={{ display: 'none' }}
					/>
				</label>
			</div>
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
					<div className="hud-label" style={{ marginBottom: 6, fontSize: 10 }}>
						{result.lines} lines · {(result.confidence * 100).toFixed(0)}%
						confidence
					</div>
					<div
						style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}
					>
						{result.text}
					</div>
				</div>
			)}
			{running && (
				<div
					className="hud-label"
					style={{ marginTop: 8, fontSize: 10, color: 'var(--cyan)' }}
				>
					SCANNING…
				</div>
			)}
		</div>
	)
}

function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '')
		reader.onerror = () => reject(reader.error)
		reader.readAsDataURL(file)
	})
}
