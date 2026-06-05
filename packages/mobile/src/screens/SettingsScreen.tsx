// Settings screen — device info, mesh name, voice wake-word toggle, secret
// rotation hint, app version.

import * as Application from 'expo-application'
import * as Device from 'expo-device'
import {
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	TextInput,
} from 'react-native'
import { useMesh } from '../state.tsx'
import { HudBody, HudLabel, HudTitle, Panel, colors } from '../ui/Hud.tsx'

export function SettingsScreen() {
	const { nodeName, setNodeName, pairing, disconnect, voice } = useMesh()
	const osName = Device.osName ?? 'unknown'
	const osVersion = Device.osVersion ?? ''
	const modelName = Device.modelName ?? 'unknown'
	const totalMemGb = Device.totalMemory
		? Math.round(Device.totalMemory / 1024 ** 3)
		: '?'

	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
			<HudTitle>SETTINGS</HudTitle>

			<Panel style={styles.section}>
				<HudLabel>NODE NAME</HudLabel>
				<TextInput
					value={nodeName}
					onChangeText={setNodeName}
					style={styles.input}
					placeholderTextColor={colors.textDim}
					autoCapitalize="none"
				/>
			</Panel>

			<Panel style={styles.section}>
				<View style={styles.row}>
					<View style={styles.col}>
						<HudLabel>WAKE WORD</HudLabel>
						<HudBody style={styles.subtle}>
							"Hey omni" via {voice.detectorBackend} detector.
							{voice.listenerState === 'listening' ? ' Listening…' : ''}
						</HudBody>
					</View>
					<Switch
						value={voice.enabled}
						onValueChange={voice.setEnabled}
						disabled={!pairing}
						trackColor={{ true: colors.cyan, false: colors.border }}
					/>
				</View>
				{voice.enabled && (
					<View style={styles.row}>
						<Pressable
							style={[styles.button, styles.buttonPrimary]}
							onPress={() => void voice.startListening()}
						>
							<HudLabel style={styles.buttonLabel}>
								{voice.listenerState === 'listening'
									? 'LISTENING'
									: 'START MIC'}
							</HudLabel>
						</Pressable>
						<Pressable
							style={[styles.button, styles.buttonGhost]}
							onPress={voice.stopListening}
						>
							<HudLabel style={styles.buttonLabel}>STOP</HudLabel>
						</Pressable>
					</View>
				)}
				{voice.listenerState === 'error' && (
					<HudBody style={styles.err}>
						⚠ Mic unavailable. Check permissions and rebuild the dev client.
					</HudBody>
				)}
			</Panel>

			<Panel style={styles.section}>
				<HudLabel>DEVICE</HudLabel>
				<HudBody>
					{modelName} • {osName} {osVersion}
				</HudBody>
				<HudBody style={styles.subtle}>{totalMemGb} GB RAM</HudBody>
				<HudBody style={styles.subtle}>
					{Platform.OS} / {Platform.Version}
				</HudBody>
			</Panel>

			<Panel style={styles.section}>
				<HudLabel>MESH</HudLabel>
				{pairing ? (
					<>
						<HudBody>
							{pairing.meshName ?? 'mesh'} @ {pairing.host}:{pairing.port}
						</HudBody>
						{pairing.providerKey ? (
							<HudBody style={styles.subtle}>
								QVAC: {pairing.providerKey.slice(0, 16)}…
							</HudBody>
						) : (
							<HudBody style={styles.subtle}>
								Transport: relay (no QVAC key)
							</HudBody>
						)}
						<Pressable
							style={[styles.button, styles.buttonGhost]}
							onPress={() => void disconnect()}
						>
							<HudLabel style={styles.buttonLabel}>DISCONNECT</HudLabel>
						</Pressable>
					</>
				) : (
					<HudBody style={styles.subtle}>Not connected.</HudBody>
				)}
			</Panel>

			<Panel style={styles.section}>
				<HudLabel>ABOUT</HudLabel>
				<HudBody>OmniMesh phone v0.2.0</HudBody>
				<HudBody style={styles.subtle}>
					Native compute node. Pairs with `omni host` over WebSocket; can
					delegate inference to workers in the mesh. Phase 6 adds the "Hey omni"
					wake word and a full voice pipeline (ASR → LLM → TTS).
				</HudBody>
				<HudBody style={styles.subtle}>
					{Application.applicationId ?? 'dev.omnimesh.app'}
				</HudBody>
			</Panel>
		</ScrollView>
	)
}

// View is referenced implicitly via flex layouts; importing it here keeps
// the styles helper consistent with other screens.
import { View } from 'react-native'

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { padding: 16, gap: 12 },
	section: { gap: 6 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
	col: { flex: 1, gap: 2 },
	input: {
		backgroundColor: 'rgba(0, 20, 40, 0.5)',
		color: colors.text,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: 4,
		paddingHorizontal: 10,
		paddingVertical: 8,
		fontSize: 14,
	},
	button: {
		flex: 1,
		borderRadius: 4,
		paddingVertical: 10,
		alignItems: 'center',
	},
	buttonPrimary: { backgroundColor: colors.cyan },
	buttonGhost: {
		backgroundColor: 'transparent',
		borderColor: colors.border,
		borderWidth: 1,
	},
	buttonLabel: { color: colors.bg, fontSize: 12, letterSpacing: 2 },
	subtle: { color: colors.textDim, fontSize: 12 },
	err: { color: colors.err, fontSize: 12, marginTop: 8 },
})
