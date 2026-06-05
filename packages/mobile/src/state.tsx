// Centralized app state. Holds the active mesh connection, the current
// pairing, the wake-listener, and the voice pipeline. Exposes hooks for
// components to subscribe.

import type { Envelope, PeerInfo } from '@omnimesh/protocol'
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'
import { detectCaps } from './caps.ts'
import { MeshClient, type MeshStatus } from './mesh/client.ts'
import { MeshInference } from './mesh/inference.ts'
import type { Pairing } from './pairing.ts'
import { QVACConsumerImpl, loadQVAC } from './qvac/consumer.ts'
import { useAppLifecycle } from './qvac/lifecycle.ts'
import { clearPairing, loadPairing, savePairing } from './storage.ts'
import { registerExpoAVRecorder } from './wake/expo-av-recorder.ts'
import { WakeListener, type WakeListenerState } from './wake/listener.ts'
import {
	VoicePipeline,
	type VoicePipelineEvents,
	type VoiceState,
} from './wake/pipeline.ts'
import { playPcm } from './wake/playback.ts'

export type VoiceContextValue = {
	state: VoiceState
	listenerState: WakeListenerState
	detectorBackend: 'native' | 'energy' | 'mock'
	startListening(): Promise<void>
	stopListening(): void
	enabled: boolean
	setEnabled(enabled: boolean): void
	turns: { role: 'user' | 'assistant'; text: string; ts: number }[]
	clearTurns(): void
}

export type MeshContextValue = {
	pairing: Pairing | null
	status: MeshStatus
	peers: PeerInfo[]
	nodeName: string
	connect: (p: Pairing, name?: string) => Promise<void>
	disconnect: () => Promise<void>
	send: (env: Envelope) => void
	inference: MeshInference | null
	setNodeName: (name: string) => void
	voice: VoiceContextValue
}

const MeshContext = createContext<MeshContextValue | null>(null)

export function MeshProvider({ children }: { children?: ReactNode }) {
	const [pairing, setPairing] = useState<Pairing | null>(null)
	const [nodeName, setNodeNameState] = useState<string>('phone')
	const [status, setStatus] = useState<MeshStatus>('idle')
	const [peers, setPeers] = useState<PeerInfo[]>([])
	const clientRef = useRef<MeshClient | null>(null)
	const inferenceRef = useRef<MeshInference | null>(null)

	const [alwaysOnVoice, setAlwaysOnVoice] = useState<boolean>(false)
	const [listenerState, setListenerState] = useState<WakeListenerState>('idle')
	const [voiceState, setVoiceState] = useState<VoiceState>('idle')
	const [turns, setTurns] = useState<
		{ role: 'user' | 'assistant'; text: string; ts: number }[]
	>([])

	const wakeRef = useRef<WakeListener | null>(null)
	const pipelineRef = useRef<VoicePipeline | null>(null)
	const qvacConsumerRef = useRef<QVACConsumerImpl | null>(null)
	const [detectorBackend, setDetectorBackend] = useState<
		'native' | 'energy' | 'mock'
	>('energy')
	const alwaysOnVoiceRef = useRef(alwaysOnVoice)

	useEffect(() => {
		alwaysOnVoiceRef.current = alwaysOnVoice
	}, [alwaysOnVoice])

	useEffect(() => {
		void loadPairing().then((p) => {
			if (p) {
				setPairing(p)
				void doConnect(p, 'phone')
			}
		})
		return () => {
			clientRef.current?.disconnect()
			wakeRef.current?.stop()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	const doConnect = useCallback(async (p: Pairing, name: string) => {
		clientRef.current?.disconnect()
		const caps = detectCaps(name, {
			alwaysOnVoice: alwaysOnVoiceRef.current ?? undefined,
		})
		const client = new MeshClient(
			{
				host: p.host,
				port: p.port,
				name,
				caps,
				token: p.token,
				...(p.providerKey ? { providerKey: p.providerKey } : {}),
			},
			{
				onStatus: setStatus,
				onPeers: setPeers,
			},
		)
		clientRef.current = client
		inferenceRef.current = new MeshInference({
			baseUrl: `http${p.host === 'localhost' || /^\d+\./.test(p.host) ? '' : 's'}://${p.host}:${p.port}`,
			token: p.token,
		})
		client.connect()
	}, [])

	const connect = useCallback(
		async (p: Pairing, name?: string) => {
			const nm = name ?? nodeName
			setPairing(p)
			await savePairing(p)
			if (name) setNodeNameState(name)
			await doConnect(p, nm)
		},
		[doConnect, nodeName],
	)

	const disconnect = useCallback(async () => {
		wakeRef.current?.stop()
		pipelineRef.current?.detach()
		clientRef.current?.disconnect()
		clientRef.current = null
		inferenceRef.current = null
		wakeRef.current = null
		pipelineRef.current = null
		setStatus('offline')
		setPeers([])
		setVoiceState('idle')
		setListenerState('idle')
		setTurns([])
		await clearPairing()
		setPairing(null)
	}, [])

	const send = useCallback((env: Envelope) => {
		clientRef.current?.send(env)
	}, [])

	const setNodeName = useCallback((name: string) => {
		setNodeNameState(name)
	}, [])

	const ensurePipeline = useCallback((): VoicePipeline | null => {
		if (!inferenceRef.current) return null
		if (pipelineRef.current) return pipelineRef.current
		registerExpoAVRecorder()
		const wake = new WakeListener()
		wakeRef.current = wake
		wake.on('state', (s: unknown) => setListenerState(s as WakeListenerState))
		wake.on('error', () => setListenerState('error'))
		setDetectorBackend(wake.getDetectorBackend())

		const events: VoicePipelineEvents = {
			onState: setVoiceState,
			onTurn: (t) =>
				setTurns((prev) => {
					const last = prev[prev.length - 1]
					if (last && last.role === t.role && Date.now() - last.ts < 250) {
						const copy = prev.slice(0, -1)
						copy.push({
							...t,
							text: last.text + (t.text === '[wake]' ? '' : ''),
						})
						return copy
					}
					return [...prev, t]
				}),
		}
		const pipe = new VoicePipeline(
			{
				listener: wake,
				inference: inferenceRef.current,
				playAudio: playPcm,
				...(qvacConsumerRef.current
					? {
							qvac: pickQVAC(qvacConsumerRef.current, peersRef.current ?? []),
						}
					: {}),
			},
			events,
		)
		pipe.attach()
		pipelineRef.current = pipe
		return pipe
	}, [])

	const startListening = useCallback(async () => {
		const pipe = ensurePipeline()
		if (!pipe) return
		try {
			await wakeRef.current?.start()
		} catch {
			setListenerState('error')
		}
	}, [ensurePipeline])

	const stopListening = useCallback(() => {
		wakeRef.current?.stop()
	}, [])

	const setEnabled = useCallback((enabled: boolean) => {
		setAlwaysOnVoice(enabled)
		if (!enabled) {
			wakeRef.current?.stop()
			pipelineRef.current?.detach()
			pipelineRef.current = null
			wakeRef.current = null
			setVoiceState('idle')
			setListenerState('idle')
		}
	}, [])

	useEffect(() => {
		void loadQVAC().then((sdk) => {
			qvacConsumerRef.current = new QVACConsumerImpl(sdk)
		})
	}, [])

	const peersRef = useRef<PeerInfo[]>([])
	useEffect(() => {
		peersRef.current = peers
	}, [peers])

	useAppLifecycle(qvacConsumerRef.current)

	const clearTurns = useCallback(() => {
		setTurns([])
		pipelineRef.current?.clearHistory()
	}, [])

	const voice = useMemo<VoiceContextValue>(
		() => ({
			state: voiceState,
			listenerState,
			detectorBackend,
			startListening,
			stopListening,
			enabled: alwaysOnVoice,
			setEnabled,
			turns,
			clearTurns,
		}),
		[
			voiceState,
			listenerState,
			detectorBackend,
			startListening,
			stopListening,
			alwaysOnVoice,
			setEnabled,
			turns,
			clearTurns,
		],
	)

	const value = useMemo<MeshContextValue>(
		() => ({
			pairing,
			status,
			peers,
			nodeName,
			connect,
			disconnect,
			send,
			inference: inferenceRef.current,
			setNodeName,
			voice,
		}),
		[
			pairing,
			status,
			peers,
			nodeName,
			connect,
			disconnect,
			send,
			setNodeName,
			voice,
		],
	)

	return <MeshContext.Provider value={value}>{children}</MeshContext.Provider>
}

export function useMesh(): MeshContextValue {
	const ctx = useContext(MeshContext)
	if (!ctx) throw new Error('useMesh must be used inside <MeshProvider>')
	return ctx
}

function pickQVAC(
	consumer: QVACConsumerImpl,
	peers: PeerInfo[],
): { consumer: QVACConsumerImpl; providerPublicKey: string } {
	const sorted = peers
		.filter((p) => p.providerPublicKey)
		.sort((a, b) => {
			const score = (p: PeerInfo) =>
				(p.directConnect === 'connected' ? 100 : 0) +
				(p.lastHeartbeatMs !== null && Date.now() - p.lastHeartbeatMs < 5_000
					? 50
					: 0) -
				(p.heartbeatRttMs >= 0 ? p.heartbeatRttMs / 10 : 50)
			return score(b) - score(a)
		})
	const best = sorted[0]
	return {
		consumer,
		providerPublicKey: best?.providerPublicKey ?? '',
	}
}
