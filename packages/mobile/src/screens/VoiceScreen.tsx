// Voice screen — shows the live wake-word state and the conversation
// transcript. Listens on the active VoicePipeline. When the user
// toggles the wake word off, the screen shows a CTA to enable it.

import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useMesh } from '../state.tsx'
import {
	HudBody,
	HudLabel,
	HudTitle,
	Panel,
	StatusDot,
	colors,
} from '../ui/Hud.tsx'

const STATE_LABEL: Record<string, string> = {
	idle: 'IDLE',
	recording: 'LISTENING FOR UTTERANCE…',
	transcribing: 'TRANSCRIBING…',
	inferring: 'THINKING…',
	speaking: 'SPEAKING…',
	error: 'ERROR',
}

export function VoiceScreen() {
	const { voice } = useMesh()
	const state = voice.state
	const stateKind: 'ok' | 'warn' | 'err' | 'idle' =
		state === 'speaking' || state === 'idle'
			? 'ok'
			: state === 'error'
				? 'err'
				: 'warn'

	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
			<HudTitle>VOICE</HudTitle>

			<Panel>
				<View style={styles.row}>
					<StatusDot status={stateKind} />
					<HudLabel>{STATE_LABEL[state] ?? state.toUpperCase()}</HudLabel>
				</View>
				<HudBody style={styles.subtle}>
					Detector: {voice.detectorBackend} • Mic: {voice.listenerState}
				</HudBody>
				{!voice.enabled ? (
					<>
						<HudBody style={styles.subtle}>
							Wake word is off. Open the SETTINGS tab to enable "Hey omni".
						</HudBody>
						<Pressable
							style={styles.cta}
							onPress={() => voice.setEnabled(true)}
						>
							<HudLabel style={styles.ctaLabel}>ENABLE WAKE WORD</HudLabel>
						</Pressable>
					</>
				) : voice.listenerState !== 'listening' ? (
					<>
						<HudBody style={styles.subtle}>
							Mic is paused. Tap to start listening for "Hey omni".
						</HudBody>
						<Pressable
							style={styles.cta}
							onPress={() => void voice.startListening()}
						>
							<HudLabel style={styles.ctaLabel}>START MIC</HudLabel>
						</Pressable>
					</>
				) : (
					<>
						<HudBody style={styles.subtle}>
							Say "Hey omni" and follow up with your question. The pipeline
							handles ASR → LLM → TTS automatically.
						</HudBody>
						<Pressable
							style={[styles.cta, styles.ctaGhost]}
							onPress={voice.stopListening}
						>
							<HudLabel style={[styles.ctaLabel, styles.ctaLabelGhost]}>
								STOP MIC
							</HudLabel>
						</Pressable>
					</>
				)}
			</Panel>

			<HudTitle style={styles.section}>TRANSCRIPT</HudTitle>
			{voice.turns.length === 0 ? (
				<Panel>
					<HudBody style={styles.subtle}>
						No turns yet. The wake word or voice will populate this list.
					</HudBody>
				</Panel>
			) : (
				voice.turns.map((t) => (
					<Panel
						key={`voice-turn-${t.ts}-${t.text.slice(0, 16)}`}
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

			{voice.turns.length > 0 && (
				<Pressable style={styles.clear} onPress={voice.clearTurns}>
					<HudLabel style={styles.clearLabel}>CLEAR TRANSCRIPT</HudLabel>
				</Pressable>
			)}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { padding: 16, gap: 8 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	section: { marginTop: 12 },
	bubble: { gap: 4 },
	bubbleUser: { borderColor: '#4499ff' },
	bubbleAssistant: { borderColor: colors.cyan },
	bubbleText: { fontFamily: 'monospace' },
	subtle: { color: colors.textDim, fontSize: 12, marginTop: 4 },
	cta: {
		marginTop: 12,
		paddingVertical: 12,
		backgroundColor: colors.cyan,
		borderRadius: 4,
		alignItems: 'center',
	},
	ctaGhost: {
		backgroundColor: 'transparent',
		borderColor: colors.err,
		borderWidth: 1,
	},
	ctaLabel: { color: colors.bg, fontSize: 12, letterSpacing: 2 },
	ctaLabelGhost: { color: colors.err },
	clear: {
		paddingVertical: 8,
		alignItems: 'center',
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: 4,
		marginTop: 4,
	},
	clearLabel: { color: colors.cyan, fontSize: 11, letterSpacing: 2 },
})
