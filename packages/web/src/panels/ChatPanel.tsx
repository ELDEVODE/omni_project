import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Send, SpeakerOff, SpeakerOn, Stop } from '../components/Icons.tsx'
import { Thinking } from '../components/Thinking.tsx'
import { api } from '../lib/api.ts'
import { playAudioResponse } from '../lib/audio.ts'

type ChatTurn = { role: 'user' | 'assistant'; text: string }

export function ChatPanel() {
	const [turns, setTurns] = useState<ChatTurn[]>([])
	const [input, setInput] = useState('')
	const [streaming, setStreaming] = useState(false)
	const [isRecording, setIsRecording] = useState(false)
	const [recStatus, setRecStatus] = useState('VOICE IDLE')
	const [ttsEnabled, setTtsEnabled] = useState(true)
	const [error, setError] = useState('')
	const outRef = useRef<HTMLDivElement | null>(null)
	const taRef = useRef<HTMLTextAreaElement | null>(null)
	const mrRef = useRef<MediaRecorder | null>(null)
	const audioRef = useRef<Blob[]>([])

	useEffect(() => {
		if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight
	}, [turns, streaming])

	useEffect(() => {
		const el = taRef.current
		if (!el) return
		el.style.height = 'auto'
		el.style.height = `${Math.min(el.scrollHeight, 140)}px`
	}, [input])

	const send = useCallback(async () => {
		if (!input.trim() || streaming) return
		const prompt = input
		setInput('')
		setStreaming(true)
		setError('')
		setTurns((t) => [
			...t,
			{ role: 'user', text: prompt },
			{ role: 'assistant', text: '' },
		])
		try {
			let acc = ''
			const res = await api.chat({
				model: 'llama-3.2-1b',
				messages: [
					...turns
						.filter((t) => t.text)
						.map((t) => ({ role: t.role, content: t.text })),
					{ role: 'user', content: prompt },
				],
				stream: true,
				temperature: 0.7,
				max_tokens: 2048,
			})
			if (!(res instanceof ReadableStream)) return
			const reader = res.getReader()
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
						const chunk = JSON.parse(raw)
						const delta = chunk.choices?.[0]?.delta?.content
						if (delta) {
							acc += delta
							setTurns((t) => {
								const copy = [...t]
								const last = copy[copy.length - 1]
								if (last && last.role === 'assistant')
									copy[copy.length - 1] = { ...last, text: acc }
								return copy
							})
						}
					} catch {}
				}
			}
			if (acc && ttsEnabled) {
				void playAudioResponse(acc).catch(() => undefined)
			}
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setStreaming(false)
		}
	}, [input, streaming, ttsEnabled, turns])

	const toggleRec = useCallback(async () => {
		if (isRecording) {
			mrRef.current?.stop()
			setIsRecording(false)
			setRecStatus('PROCESSING…')
			return
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			audioRef.current = []
			const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
			mr.ondataavailable = (e) => {
				if (e.data.size > 0) audioRef.current.push(e.data)
			}
			mr.onstop = async () => {
				setRecStatus('TRANSCRIBING…')
				const blob = new Blob(audioRef.current, { type: 'audio/webm' })
				const res = await fetch('/api/transcribe-voice', {
					method: 'POST',
					headers: { 'Content-Type': 'audio/webm' },
					body: blob,
				})
				const result = (await res.json()) as { text?: string; error?: string }
				if (result.text) {
					setInput(result.text)
					setRecStatus('READY ✓')
				} else {
					setRecStatus(`ERROR: ${result.error ?? 'unknown'}`)
				}
			}
			mrRef.current = mr
			mr.start(250)
			setIsRecording(true)
			setRecStatus('LISTENING…')
		} catch {
			setRecStatus('MIC BLOCKED')
		}
	}, [isRecording])

	const speak = async (text: string) => {
		if (!text || !ttsEnabled) return
		try {
			await playAudioResponse(text)
		} catch (err) {
			setError(`TTS: ${(err as Error).message}`)
		}
	}

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				gap: 8,
			}}
		>
			<div
				ref={outRef}
				style={{
					flex: 1,
					overflowY: 'auto',
					padding: '12px 16px',
					fontSize: 13,
					lineHeight: 1.6,
					background: 'rgba(0,20,40,0.3)',
					border: '1px solid rgba(0,212,255,0.1)',
				}}
			>
				{turns.length === 0 && (
					<div style={{ textAlign: 'center', opacity: 0.5, padding: 40 }}>
						<p className="hud-label">Start a conversation with the cluster</p>
					</div>
				)}
				{turns.map((t) => (
					<div
						key={`${t.role}-${t.text.slice(0, 32)}`}
						style={{
							marginBottom: 12,
							padding: 8,
							borderLeft:
								t.role === 'user'
									? '2px solid #4499ff'
									: '2px solid var(--cyan)',
							background:
								t.role === 'user'
									? 'rgba(0,87,255,0.05)'
									: 'rgba(0,212,255,0.05)',
						}}
					>
						<div
							className="hud-label"
							style={{ opacity: 0.5, fontSize: 9, marginBottom: 4 }}
						>
							{t.role === 'user' ? 'YOU' : 'CLUSTER'}
						</div>
						<div style={{ whiteSpace: 'pre-wrap' }}>{t.text}</div>
						{t.role === 'assistant' && t.text && !streaming && (
							<button
								onClick={() => speak(t.text)}
								disabled={!ttsEnabled}
								style={{
									marginTop: 4,
									background: 'transparent',
									border: '1px solid rgba(0,212,255,0.3)',
									color: 'var(--cyan)',
									padding: '2px 6px',
									fontSize: 9,
									cursor: ttsEnabled ? 'pointer' : 'not-allowed',
									opacity: ttsEnabled ? 1 : 0.4,
								}}
							>
								▶ REPLAY
							</button>
						)}
					</div>
				))}
				{streaming && <Thinking />}
				{error && (
					<div style={{ color: '#ff6a00', fontSize: 11, marginTop: 8 }}>
						⚠ {error}
					</div>
				)}
			</div>

			<div
				style={{
					display: 'flex',
					gap: 6,
					alignItems: 'center',
					padding: '0 4px',
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 6,
						padding: '4px 8px',
						background: isRecording
							? 'rgba(255,45,85,0.1)'
							: 'rgba(0,20,40,0.4)',
						border: `1px solid ${isRecording ? '#ff2d55' : 'rgba(0,212,255,0.2)'}`,
						fontSize: 9,
					}}
				>
					<span
						style={{
							width: 6,
							height: 6,
							borderRadius: '50%',
							background: isRecording ? '#ff2d55' : 'rgba(0,255,159,0.5)',
							boxShadow: isRecording ? '0 0 6px #ff2d55' : 'none',
						}}
					/>
					<span
						className="hud-label"
						style={{
							opacity: 1,
							color: isRecording ? '#ff7090' : 'rgba(0,255,159,0.7)',
						}}
					>
						{recStatus}
					</span>
				</div>
				<button
					onClick={() => setTtsEnabled((v) => !v)}
					style={{
						background: ttsEnabled ? 'rgba(0,212,255,0.1)' : 'transparent',
						border: '1px solid rgba(0,212,255,0.3)',
						color: ttsEnabled ? 'var(--cyan)' : 'rgba(0,212,255,0.4)',
						padding: '4px 8px',
						fontSize: 9,
						cursor: 'pointer',
					}}
				>
					{ttsEnabled ? <SpeakerOn s={11} /> : <SpeakerOff s={11} />} TTS
				</button>
			</div>

			<div style={{ display: 'flex', gap: 6 }}>
				<button
					onClick={toggleRec}
					title={isRecording ? 'Stop' : 'Voice input'}
					style={{
						width: 38,
						height: 38,
						borderRadius: 4,
						background: isRecording
							? 'rgba(255,45,85,0.2)'
							: 'rgba(0,20,40,0.4)',
						border: `1px solid ${isRecording ? '#ff2d55' : 'var(--border)'}`,
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'pointer',
					}}
				>
					{isRecording ? <Stop s={12} /> : <Mic s={14} />}
				</button>
				<textarea
					ref={taRef}
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault()
							void send()
						}
					}}
					placeholder="Ask the cluster… (Enter to send)"
					rows={1}
					style={{
						flex: 1,
						background: 'rgba(0,20,40,0.4)',
						border: '1px solid var(--border)',
						color: 'var(--text-bright)',
						borderRadius: 4,
						padding: '8px 10px',
						resize: 'none',
						fontSize: 13,
						lineHeight: 1.5,
						fontFamily: 'inherit',
					}}
				/>
				<button
					onClick={send}
					disabled={!input.trim() || streaming}
					style={{
						width: 38,
						height: 38,
						borderRadius: 4,
						background: 'rgba(0,87,255,0.15)',
						border: '1px solid rgba(0,87,255,0.4)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: !input.trim() || streaming ? 'not-allowed' : 'pointer',
						opacity: !input.trim() || streaming ? 0.4 : 1,
					}}
				>
					<Send s={13} />
				</button>
			</div>
		</div>
	)
}
