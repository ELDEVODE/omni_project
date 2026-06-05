import { useEffect, useState } from 'react'
import { ArcReactor } from './components/ArcReactor.tsx'
import { SpeakerOff, SpeakerOn } from './components/Icons.tsx'
import { Panel, PanelBar } from './components/Panel.tsx'
import { useQVACModels } from './hooks/useQVACChat.ts'
import { ChatPanel } from './panels/ChatPanel.tsx'
import { ClassifyPanel } from './panels/ClassifyPanel.tsx'
import { EmbeddingsPanel } from './panels/EmbeddingsPanel.tsx'
import { ImageGenPanel } from './panels/ImageGenPanel.tsx'
import { ModelsPanel } from './panels/ModelsPanel.tsx'
import { OcrPanel } from './panels/OcrPanel.tsx'
import { OpenAIPanel } from './panels/OpenAIPanel.tsx'
import { SpeakPanel } from './panels/SpeakPanel.tsx'
import { TranscribePanel } from './panels/TranscribePanel.tsx'
import { TranslatePanel } from './panels/TranslatePanel.tsx'
import { VideoGenPanel } from './panels/VideoGenPanel.tsx'
import { VoicePanel } from './panels/VoicePanel.tsx'

type PanelId =
	| 'chat'
	| 'models'
	| 'embeddings'
	| 'classify'
	| 'translate'
	| 'ocr'
	| 'image-gen'
	| 'video-gen'
	| 'transcribe'
	| 'speak'
	| 'voice'
	| 'openai'

const PANEL_LABELS: Record<PanelId, string> = {
	chat: 'CHAT // LLM',
	models: 'MODELS // REGISTRY',
	embeddings: 'EMBEDDINGS // BGE',
	classify: 'CLASSIFY // ZERO-SHOT',
	translate: 'TRANSLATE // LLM',
	ocr: 'OCR // VISION LLM',
	'image-gen': 'IMAGE GEN // /v1',
	'video-gen': 'VIDEO GEN // /v1',
	transcribe: 'TRANSCRIBE // ASR',
	speak: 'SPEAK // TTS',
	voice: 'VOICE // ASR→LLM→TTS',
	openai: 'OPENAI // /v1',
}

const PANEL_NAV_ORDER: PanelId[] = [
	'chat',
	'models',
	'embeddings',
	'classify',
	'translate',
	'ocr',
	'image-gen',
	'video-gen',
	'transcribe',
	'speak',
	'voice',
	'openai',
]

function renderPanel(id: PanelId) {
	switch (id) {
		case 'chat':
			return <ChatPanel />
		case 'models':
			return <ModelsPanel />
		case 'embeddings':
			return <EmbeddingsPanel />
		case 'classify':
			return <ClassifyPanel />
		case 'translate':
			return <TranslatePanel />
		case 'ocr':
			return <OcrPanel />
		case 'image-gen':
			return <ImageGenPanel />
		case 'video-gen':
			return <VideoGenPanel />
		case 'transcribe':
			return <TranscribePanel />
		case 'speak':
			return <SpeakPanel />
		case 'voice':
			return <VoicePanel />
		case 'openai':
			return <OpenAIPanel />
		default:
			return null
	}
}

export default function App() {
	const [active, setActive] = useState<PanelId>('chat')
	const [authToken, setAuthToken] = useState('')
	const [ttsEnabled, setTtsEnabled] = useState(true)
	const { models, loading: modelsLoading, load: loadModels } = useQVACModels()

	useEffect(() => {
		const stored = localStorage.getItem('omni.secret') ?? ''
		setAuthToken(stored)
		loadModels()
	}, [loadModels])

	const applyToken = () => {
		setAuthToken(authToken)
		window.location.reload()
	}

	return (
		<div
			className="app-shell"
			style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}
		>
			<header
				className="app-header"
				style={{
					display: 'flex',
					alignItems: 'center',
					padding: '10px 16px',
					gap: 12,
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 12,
						flex: 1,
						minWidth: 0,
					}}
				>
					<ArcReactor size={40} />
					<div style={{ minWidth: 0 }}>
						<h1
							className="hud-title"
							style={{
								fontSize: 'clamp(14px, 4vw, 20px)',
								fontWeight: 700,
								color: 'var(--text-bright)',
								whiteSpace: 'nowrap',
							}}
						>
							OMNI
							<span
								style={{
									color: 'var(--cyan)',
									textShadow: '0 0 12px var(--cyan)',
								}}
							>
								MESH
							</span>
							<span
								style={{
									color: 'rgba(0,212,255,0.4)',
									fontSize: '0.55em',
									marginLeft: 6,
								}}
							>
								CORE
							</span>
						</h1>
						<p className="hud-label" style={{ marginTop: 1 }}>
							SOVEREIGN POLYMATH WORKSPACE
						</p>
					</div>
				</div>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<input
						type="password"
						value={authToken}
						onChange={(e) => setAuthToken(e.target.value)}
						placeholder="bearer token"
						style={{
							width: 160,
							background: 'rgba(0,20,40,0.4)',
							border: '1px solid var(--border)',
							color: 'var(--text-bright)',
							padding: '4px 8px',
							borderRadius: 4,
							fontSize: 10,
							fontFamily: 'var(--font-mono)',
						}}
					/>
					<button
						onClick={applyToken}
						style={{
							background: 'rgba(0,212,255,0.1)',
							border: '1px solid rgba(0,212,255,0.3)',
							color: 'var(--cyan)',
							padding: '4px 8px',
							fontSize: 9,
							cursor: 'pointer',
							borderRadius: 4,
						}}
					>
						APPLY
					</button>
					<button
						onClick={() => setTtsEnabled((v) => !v)}
						title="TTS"
						style={{
							width: 28,
							height: 28,
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							borderRadius: 4,
							background: ttsEnabled ? 'rgba(0,212,255,0.1)' : 'transparent',
							border: `1px solid ${ttsEnabled ? 'rgba(0,212,255,0.4)' : 'var(--border)'}`,
							color: ttsEnabled ? 'var(--cyan)' : 'rgba(0,212,255,0.3)',
						}}
					>
						{ttsEnabled ? <SpeakerOn s={12} /> : <SpeakerOff s={12} />}
					</button>
				</div>
			</header>

			<div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
				<nav
					style={{
						width: 180,
						background: 'rgba(0,10,20,0.6)',
						borderRight: '1px solid rgba(0,212,255,0.1)',
						overflowY: 'auto',
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{PANEL_NAV_ORDER.map((id) => (
						<button
							key={id}
							onClick={() => setActive(id)}
							style={{
								background:
									active === id ? 'rgba(0,212,255,0.1)' : 'transparent',
								border: 'none',
								borderLeft:
									active === id
										? '2px solid var(--cyan)'
										: '2px solid transparent',
								color: active === id ? 'var(--cyan)' : 'rgba(0,212,255,0.6)',
								textAlign: 'left',
								padding: '10px 12px',
								fontSize: 11,
								fontFamily: 'var(--font-hud)',
								letterSpacing: '0.05em',
								cursor: 'pointer',
								borderBottom: '1px solid rgba(0,212,255,0.05)',
							}}
							title={PANEL_LABELS[id]}
						>
							{PANEL_LABELS[id]}
						</button>
					))}
				</nav>

				<main
					style={{
						flex: 1,
						display: 'flex',
						flexDirection: 'column',
						overflow: 'hidden',
					}}
				>
					<Panel
						style={{
							flex: 1,
							display: 'flex',
							flexDirection: 'column',
							margin: 0,
							borderRadius: 0,
						}}
					>
						<PanelBar label={PANEL_LABELS[active] ?? active.toUpperCase()} />
						<div
							style={{
								flex: 1,
								overflow: 'hidden',
								display: 'flex',
								flexDirection: 'column',
							}}
						>
							{renderPanel(active)}
						</div>
					</Panel>
				</main>
			</div>

			<div
				style={{
					padding: '8px 16px',
					background: 'rgba(0,10,20,0.6)',
					borderTop: '1px solid rgba(0,212,255,0.1)',
					display: 'flex',
					gap: 8,
					overflowX: 'auto',
				}}
			>
				{modelsLoading ? (
					<span className="hud-label" style={{ opacity: 0.4, fontSize: 9 }}>
						Loading models…
					</span>
				) : models.length === 0 ? (
					<span className="hud-label" style={{ opacity: 0.4, fontSize: 9 }}>
						No models loaded — use Models panel to pull
					</span>
				) : (
					models.map((m) => (
						<ModelChip key={m.id} model={m} />
					))
				)}
			</div>
		</div>
	)
}

function ModelChip({ model }: { model: { id: string } }) {
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 6,
				padding: '4px 8px',
				background: 'rgba(0,20,40,0.4)',
				border: '1px solid rgba(0,212,255,0.2)',
				borderRadius: 4,
				flexShrink: 0,
			}}
		>
			<span style={{ color: 'var(--cyan)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
				{model.id}
			</span>
		</div>
	)
}
