import { useRef, useState } from 'react'
import { Elapsed, Spinner } from '../components/Progress.tsx'
import { api } from '../lib/api.ts'

export function TranscribePanel() {
	const [transcript, setTranscript] = useState('')
	const [running, setRunning] = useState(false)
	const [error, setError] = useState('')
	const [recording, setRecording] = useState(false)
	const [startedAt, setStartedAt] = useState(0)
	const audioRef = useRef<Blob[]>([])
	const mrRef = useRef<MediaRecorder | null>(null)

	const start = async () => {
		audioRef.current = []
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
		const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
		mr.ondataavailable = (e) => {
			if (e.data.size > 0) audioRef.current.push(e.data)
		}
		mrRef.current = mr
		mr.start(250)
		setRecording(true)
	}

	const stop = async () => {
		if (!mrRef.current) return
		mrRef.current.stop()
		setRecording(false)
		const blob = new Blob(audioRef.current, { type: 'audio/webm' })
		setStartedAt(Date.now())
		setRunning(true)
		setError('')
		setTranscript('')
		try {
			const text = await api.transcribe(blob, 'whisper')
			setTranscript(text)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setRunning(false)
		}
	}

	const onFile = async (file: File) => {
		setStartedAt(Date.now())
		setRunning(true)
		setError('')
		setTranscript('')
		try {
			const text = await api.transcribe(file, 'whisper')
			setTranscript(text)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setRunning(false)
		}
	}

	return (
		<div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
			<p className="hud-label" style={{ marginBottom: 8, opacity: 0.6 }}>
				Speech-to-text via /v1/audio/transcriptions. Record mic or upload file.
			</p>
			<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				<button
					onClick={recording ? stop : start}
					style={{
						background: recording
							? 'rgba(255,45,85,0.2)'
							: 'rgba(0,212,255,0.1)',
						border: `1px solid ${recording ? '#ff2d55' : 'rgba(0,212,255,0.3)'}`,
						color: recording ? '#ff7090' : 'var(--cyan)',
						padding: '6px 12px',
						fontSize: 11,
						cursor: 'pointer',
						borderRadius: 4,
					}}
				>
					{recording ? '■ STOP' : '● RECORD'}
				</button>
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
					⇪ UPLOAD
					<input
						type="file"
						accept="audio/*"
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
			{transcript && (
				<div
					style={{
						marginTop: 12,
						padding: 12,
						background: 'rgba(0,212,255,0.04)',
						border: '1px solid rgba(0,212,255,0.2)',
						borderRadius: 4,
						fontSize: 13,
						lineHeight: 1.6,
					}}
				>
					{transcript}
				</div>
			)}
			{running && (
				<div
					style={{
						marginTop: 8,
						display: 'flex',
						alignItems: 'center',
						gap: 10,
					}}
				>
					<Spinner size={11} label="PROCESSING" />
					{startedAt > 0 ? <Elapsed from={startedAt} /> : null}
				</div>
			)}
		</div>
	)
}
