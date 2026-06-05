// Chat screen — sends a completion request through the mesh.
// Streams INFER_DELTA events back and renders them in real time.

import { useRef, useState } from 'react'
import {
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from 'react-native'
import { useMesh } from '../state.tsx'
import { HudBody, HudLabel, HudTitle, Panel, colors } from '../ui/Hud.tsx'

type Turn = { role: 'user' | 'assistant'; text: string }

export function ChatScreen() {
	const { inference, status, peers } = useMesh()
	const [turns, setTurns] = useState<Turn[]>([])
	const [input, setInput] = useState('')
	const [busy, setBusy] = useState(false)
	const abortRef = useRef<AbortController | null>(null)

	const ready = status === 'online' && inference !== null

	async function send() {
		if (!ready || !inference) return
		const text = input.trim()
		if (!text) return
		setInput('')
		setBusy(true)
		const newTurns: Turn[] = [...turns, { role: 'user', text }]
		setTurns([...newTurns, { role: 'assistant', text: '' }])
		abortRef.current = new AbortController()
		let acc = ''
		await inference.infer(
			{
				modelId: 'mistral-7b-instruct-q4',
				input: {
					messages: newTurns.map((t) => ({ role: t.role, content: t.text })),
				},
				stream: true,
			},
			(ev) => {
				if (ev.type === 'delta') {
					const delta = (ev.delta as { text?: string } | undefined)?.text ?? ''
					acc += delta
					setTurns((prev) => {
						const copy = [...prev]
						const last = copy[copy.length - 1]
						if (last?.role === 'assistant') {
							copy[copy.length - 1] = { role: 'assistant', text: acc }
						}
						return copy
					})
				} else if (ev.type === 'error') {
					setTurns((prev) => {
						const copy = [...prev]
						const last = copy[copy.length - 1]
						if (last?.role === 'assistant') {
							copy[copy.length - 1] = {
								role: 'assistant',
								text: `[error] ${ev.error}`,
							}
						}
						return copy
					})
				} else if (ev.type === 'done') {
					setBusy(false)
				}
			},
			abortRef.current.signal,
		)
		setBusy(false)
	}

	function stop() {
		abortRef.current?.abort()
		setBusy(false)
	}

	const totalLoad = peers.filter((p) => p.online).length

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<HudTitle>CHAT</HudTitle>
			<HudLabel style={styles.subtitle}>
				Delegated to mesh workers{' '}
				{peers.length === 0
					? '(no peers)'
					: `(${peers.length}, load ${totalLoad})`}
			</HudLabel>

			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.scrollContent}
			>
				{turns.length === 0 ? (
					<Panel>
						<HudBody style={styles.subtle}>
							{ready
								? 'Type a message below. The mesh will route to the best available worker.'
								: 'Join a mesh on the JOIN tab to begin.'}
						</HudBody>
					</Panel>
				) : (
					turns.map((t, i) => (
						<Panel
							key={`${t.role}-${i}`}
							style={[
								styles.bubble,
								t.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
							]}
						>
							<HudLabel>{t.role === 'user' ? 'YOU' : 'OMNI'}</HudLabel>
							<HudBody style={styles.bubbleText}>{t.text || '…'}</HudBody>
						</Panel>
					))
				)}
			</ScrollView>

			<View style={styles.inputRow}>
				<TextInput
					value={input}
					onChangeText={setInput}
					placeholder={ready ? 'Type a message…' : 'Not connected'}
					placeholderTextColor={colors.textDim}
					style={styles.input}
					editable={ready}
					multiline
					onSubmitEditing={() => void send()}
				/>
				{busy ? (
					<Pressable style={[styles.button, styles.buttonGhost]} onPress={stop}>
						<HudLabel style={styles.buttonLabel}>STOP</HudLabel>
					</Pressable>
				) : (
					<Pressable
						style={[styles.button, !ready && styles.buttonDisabled]}
						onPress={() => void send()}
						disabled={!ready}
					>
						<HudLabel style={styles.buttonLabel}>SEND</HudLabel>
					</Pressable>
				)}
			</View>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg, padding: 16 },
	subtitle: { marginTop: 4, marginBottom: 12 },
	scroll: { flex: 1 },
	scrollContent: { gap: 8, paddingBottom: 12 },
	bubble: { gap: 4 },
	bubbleUser: { borderColor: '#4499ff' },
	bubbleAssistant: { borderColor: colors.cyan },
	bubbleText: {
		fontFamily: Platform.select({
			ios: 'Menlo',
			android: 'monospace',
			default: 'monospace',
		}),
	},
	subtle: { color: colors.textDim, fontSize: 12 },
	inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
	input: {
		flex: 1,
		backgroundColor: 'rgba(0, 20, 40, 0.5)',
		color: colors.text,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: 4,
		paddingHorizontal: 10,
		paddingVertical: 8,
		fontSize: 14,
		maxHeight: 120,
	},
	button: {
		backgroundColor: colors.cyan,
		borderRadius: 4,
		paddingVertical: 10,
		paddingHorizontal: 16,
	},
	buttonGhost: {
		backgroundColor: 'transparent',
		borderColor: colors.err,
		borderWidth: 1,
	},
	buttonDisabled: { opacity: 0.4 },
	buttonLabel: { color: colors.bg, fontSize: 12, letterSpacing: 2 },
})
