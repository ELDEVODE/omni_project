import { Bar, Elapsed, Spinner } from '@/components/Progress.tsx'
import { useQVACModels } from '@/hooks/useQVACChat.ts'
import { api } from '@/lib/api.ts'
import { useEffect, useState } from 'react'

type InstallState = {
	installId: string
	capability: string
	status: 'queued' | 'running' | 'done' | 'fail' | 'cancel'
	percent: number
	message: string
}

const AVAILABLE_MODELS = [
	{
		alias: 'llama-3.2-1b',
		name: 'Llama 3.2 1B Instruct Q4_0',
		kind: 'llm',
		size: '~1.3 GB',
	},
	{
		alias: 'qwen3-600m',
		name: 'Qwen3 600M Instruct Q4',
		kind: 'llm',
		size: '~400 MB',
	},
	{
		alias: 'whisper',
		name: 'Whisper Tiny',
		kind: 'transcription',
		size: '~75 MB',
	},
	{
		alias: 'tts',
		name: 'Chatterbox TTS (Supertonic)',
		kind: 'tts',
		size: '~500 MB',
	},
	{
		alias: 'embed',
		name: 'GTE Large FP16',
		kind: 'embeddings',
		size: '~1.3 GB',
	},
]

export function ModelsPanel() {
	const { models, loading, load } = useQVACModels()
	const [pulling, setPulling] = useState<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [pullProgress, setPullProgress] = useState<{
		installId: string
		percent: number
		message: string
		startedAt: number
	} | null>(null)

	// Poll the host's /api/installs/:id endpoint while a pull is in flight
	// so the in-card progress bar reflects the runner's live state.
	useEffect(() => {
		if (!pullProgress) return
		const id = pullProgress.installId
		const t = setInterval(async () => {
			try {
				const res = await fetch(`/api/installs/${encodeURIComponent(id)}`)
				if (!res.ok) return
				const s = (await res.json()) as InstallState
				setPullProgress((p) =>
					p
						? {
								installId: s.installId,
								percent: s.percent,
								message: s.message,
								startedAt: p.startedAt,
							}
						: p,
				)
				if (s.status === 'done') {
					setSuccess(`Pulled ${pulling}`)
					setPulling(null)
					setPullProgress(null)
					void load()
				} else if (s.status === 'fail' || s.status === 'cancel') {
					setError(s.message || `pull ${s.status}`)
					setPulling(null)
					setPullProgress(null)
				}
			} catch {}
		}, 500)
		return () => clearInterval(t)
	}, [pullProgress, pulling, load])

	const handlePull = async (alias: string) => {
		setError(null)
		setSuccess(null)
		setPulling(alias)
		try {
			const res = await fetch('/api/models/pull', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ modelId: alias }),
			})
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}`)
			}
			const body = (await res.json()) as { installId?: string }
			if (body.installId) {
				setPullProgress({
					installId: body.installId,
					percent: 0,
					message: 'queued',
					startedAt: Date.now(),
				})
			} else {
				// Endpoint returned a non-install response; reload after a
				// short delay to pick up the new model.
				setSuccess(`Pull started for ${alias}`)
				setPulling(null)
				setTimeout(() => void load(), 2000)
			}
		} catch (err) {
			setError((err as Error).message)
			setPulling(null)
		}
	}

	const handleDelete = async (alias: string) => {
		setError(null)
		setSuccess(null)
		try {
			await api.models() // reload first
			const res = await fetch(`/v1/models/${alias}`, { method: 'DELETE' })
			if (res.ok) {
				setSuccess(`Unloaded ${alias}`)
				await load()
			} else {
				throw new Error(`HTTP ${res.status}`)
			}
		} catch (err) {
			setError((err as Error).message)
		}
	}

	return (
		<div
			style={{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				padding: 16,
				gap: 16,
				overflow: 'auto',
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 12,
				}}
			>
				<h2
					style={{
						color: 'var(--cyan)',
						fontSize: 14,
						fontWeight: 600,
						letterSpacing: '0.1em',
					}}
				>
					QVAC MODEL REGISTRY
				</h2>
				<button
					onClick={load}
					disabled={loading}
					style={{
						background: 'rgba(0,212,255,0.1)',
						border: '1px solid rgba(0,212,255,0.3)',
						color: 'var(--cyan)',
						padding: '6px 12px',
						fontSize: 10,
						fontFamily: 'var(--font-hud)',
						borderRadius: 4,
						cursor: loading ? 'not-allowed' : 'pointer',
						opacity: loading ? 0.6 : 1,
					}}
				>
					{loading ? 'REFRESHING…' : 'REFRESH'}
				</button>
			</div>

			{error && (
				<div
					style={{
						color: 'var(--red)',
						fontSize: 10,
						fontFamily: 'var(--font-mono)',
						padding: '8px',
						background: 'rgba(255,0,64,0.1)',
						border: '1px solid rgba(255,0,64,0.3)',
						borderRadius: 4,
					}}
				>
					ERROR: {error}
				</div>
			)}
			{success && (
				<div
					style={{
						color: 'var(--green)',
						fontSize: 10,
						fontFamily: 'var(--font-mono)',
						padding: '8px',
						background: 'rgba(0,255,128,0.1)',
						border: '1px solid rgba(0,255,128,0.3)',
						borderRadius: 4,
					}}
				>
					{success}
				</div>
			)}

			<div
				style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}
			>
				{loading ? (
					<div
						style={{
							textAlign: 'center',
							color: 'var(--cyan)',
							padding: 32,
							display: 'flex',
							justifyContent: 'center',
							alignItems: 'center',
							gap: 10,
						}}
					>
						<Spinner size={12} label="Loading models from /v1/models" />
					</div>
				) : models.length === 0 ? (
					<div
						style={{
							textAlign: 'center',
							color: 'rgba(0,212,255,0.4)',
							padding: 32,
						}}
					>
						No models loaded. Pull a model from the registry below.
					</div>
				) : (
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
							gap: 12,
						}}
					>
						{models.map((m) => (
							<ModelCard key={m.id} model={m} onDelete={handleDelete} />
						))}
					</div>
				)}

				<div
					style={{ borderTop: '1px solid rgba(0,212,255,0.1)', paddingTop: 16 }}
				>
					<h3
						style={{
							color: 'rgba(0,212,255,0.6)',
							fontSize: 11,
							fontWeight: 600,
							letterSpacing: '0.1em',
							marginBottom: 12,
						}}
					>
						AVAILABLE IN REGISTRY
					</h3>
					<div
						style={{
							display: 'grid',
							gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
							gap: 12,
						}}
					>
						{AVAILABLE_MODELS.map((m) => (
							<RegistryCard
								key={m.alias}
								model={m}
								loaded={models.some((lm) => lm.id === m.alias)}
								onPull={handlePull}
								pulling={pulling === m.alias}
								pullProgress={pulling === m.alias ? pullProgress : null}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

function ModelCard({
	model,
	onDelete,
}: { model: { id: string }; onDelete: (alias: string) => void }) {
	return (
		<div
			style={{
				background: 'rgba(0,20,40,0.4)',
				border: '1px solid rgba(0,212,255,0.2)',
				borderRadius: 8,
				padding: 12,
				display: 'flex',
				flexDirection: 'column',
				gap: 8,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
				}}
			>
				<span
					style={{
						color: 'var(--cyan)',
						fontFamily: 'var(--font-mono)',
						fontSize: 12,
						fontWeight: 600,
					}}
				>
					{model.id}
				</span>
				<span
					style={{
						color: 'var(--green)',
						fontSize: 10,
						background: 'rgba(0,255,128,0.1)',
						padding: '2px 6px',
						borderRadius: 3,
					}}
				>
					LOADED
				</span>
			</div>
			<button
				onClick={() => onDelete(model.id)}
				style={{
					background: 'rgba(255,0,64,0.1)',
					border: '1px solid rgba(255,0,64,0.3)',
					color: 'var(--red)',
					padding: '6px 12px',
					fontSize: 10,
					fontFamily: 'var(--font-hud)',
					borderRadius: 4,
					cursor: 'pointer',
					alignSelf: 'flex-start',
				}}
			>
				UNLOAD
			</button>
		</div>
	)
}

function RegistryCard({
	model,
	loaded,
	onPull,
	pulling,
	pullProgress,
}: {
	model: (typeof AVAILABLE_MODELS)[0]
	loaded: boolean
	onPull: (alias: string) => void
	pulling: boolean
	pullProgress: {
		installId: string
		percent: number
		message: string
		startedAt: number
	} | null
}) {
	return (
		<div
			style={{
				background: 'rgba(0,20,40,0.4)',
				border: '1px solid rgba(0,212,255,0.2)',
				borderRadius: 8,
				padding: 12,
				display: 'flex',
				flexDirection: 'column',
				gap: 8,
				opacity: loaded ? 0.6 : 1,
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'flex-start',
					justifyContent: 'space-between',
					gap: 8,
				}}
			>
				<div>
					<span
						style={{
							color: 'var(--text-bright)',
							fontFamily: 'var(--font-mono)',
							fontSize: 12,
							fontWeight: 600,
						}}
					>
						{model.alias}
					</span>
					<div
						style={{ color: 'rgba(0,212,255,0.6)', fontSize: 9, marginTop: 2 }}
					>
						{model.name} · {model.kind} · {model.size}
					</div>
				</div>
				{loaded ? (
					<span
						style={{
							color: 'var(--green)',
							fontSize: 10,
							background: 'rgba(0,255,128,0.1)',
							padding: '2px 6px',
							borderRadius: 3,
						}}
					>
						LOADED
					</span>
				) : pulling ? (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							gap: 6,
							color: 'var(--cyan)',
							fontSize: 10,
						}}
					>
						<Spinner size={10} />
						<span>PULLING</span>
					</div>
				) : (
					<button
						onClick={() => onPull(model.alias)}
						style={{
							background: 'rgba(0,212,255,0.1)',
							border: '1px solid rgba(0,212,255,0.3)',
							color: 'var(--cyan)',
							padding: '6px 12px',
							fontSize: 10,
							fontFamily: 'var(--font-hud)',
							borderRadius: 4,
							cursor: 'pointer',
						}}
					>
						PULL
					</button>
				)}
			</div>
			{pulling && pullProgress ? (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 4,
					}}
				>
					<Bar
						percent={pullProgress.percent}
						label={pullProgress.message}
						right={
							<>
								{pullProgress.percent.toFixed(0)}%{'\u00A0\u00A0'}
								<Elapsed from={pullProgress.startedAt} />
							</>
						}
					/>
				</div>
			) : null}
		</div>
	)
}
