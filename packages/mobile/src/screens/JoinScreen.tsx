// Join screen — paste an omni:// URI or scan a QR (QR scanner is Phase 6).
// On submit, persists the pairing and connects to the host.

import { useState } from 'react'
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from 'react-native'
import { parsePairing } from '../pairing.ts'
import { useMesh } from '../state.tsx'
import {
	HudBody,
	HudLabel,
	HudTitle,
	Panel,
	StatusDot,
	colors,
} from '../ui/Hud.tsx'

export function JoinScreen() {
	const { connect, disconnect, status, pairing } = useMesh()
	const [text, setText] = useState('')
	const [name, setName] = useState('phone')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	async function onSubmit() {
		setError(null)
		const parsed = parsePairing(text)
		if (!parsed) {
			setError('Invalid URI. Expected: omni://host?port=…&token=…')
			return
		}
		setBusy(true)
		try {
			await connect(parsed, name)
		} catch (err) {
			setError((err as Error).message)
		} finally {
			setBusy(false)
		}
	}

	const statusKind: 'ok' | 'warn' | 'err' | 'idle' =
		status === 'online'
			? 'ok'
			: status === 'connecting'
				? 'warn'
				: status === 'offline'
					? 'err'
					: 'idle'

	return (
		<KeyboardAvoidingView
			style={styles.root}
			behavior={Platform.OS === 'ios' ? 'padding' : undefined}
		>
			<ScrollView
				contentContainerStyle={styles.scroll}
				keyboardShouldPersistTaps="handled"
			>
				<HudTitle>JOIN MESH</HudTitle>
				<HudLabel style={styles.subtitle}>
					Pair your phone with a host on your network
				</HudLabel>

				<Panel style={styles.section}>
					<View style={styles.row}>
						<StatusDot status={statusKind} />
						<HudLabel>{status.toUpperCase()}</HudLabel>
						{pairing ? (
							<HudBody style={styles.connectedHost}>
								{pairing.meshName ?? 'mesh'} @ {pairing.host}:{pairing.port}
							</HudBody>
						) : null}
					</View>
					{status === 'online' ? (
						<Pressable
							style={[styles.button, styles.buttonGhost]}
							onPress={() => void disconnect()}
						>
							<HudLabel style={styles.buttonLabel}>DISCONNECT</HudLabel>
						</Pressable>
					) : null}
				</Panel>

				<Panel style={styles.section}>
					<HudLabel>NODE NAME</HudLabel>
					<TextInput
						value={name}
						onChangeText={setName}
						placeholder="phone"
						placeholderTextColor={colors.textDim}
						style={styles.input}
						autoCapitalize="none"
						autoCorrect={false}
					/>

					<HudLabel style={[styles.labelSpacer]}>PAIRING URI</HudLabel>
					<TextInput
						value={text}
						onChangeText={setText}
						placeholder="omni://host:port?port=…&token=…"
						placeholderTextColor={colors.textDim}
						style={[styles.input, styles.inputMulti]}
						autoCapitalize="none"
						autoCorrect={false}
						multiline
					/>

					{error ? <HudBody style={styles.error}>{error}</HudBody> : null}

					<Pressable
						style={[styles.button, busy && styles.buttonDisabled]}
						onPress={() => void onSubmit()}
						disabled={busy}
					>
						{busy ? (
							<ActivityIndicator color={colors.bg} />
						) : (
							<HudLabel style={styles.buttonLabel}>
								{status === 'online' ? 'REJOIN' : 'JOIN'}
							</HudLabel>
						)}
					</Pressable>

					<HudBody style={styles.hint}>
						Run `omni host` on your desktop. The CLI prints an omni:// URI you
						can paste here, or a QR code you can scan (coming in Phase 6).
					</HudBody>
				</Panel>
			</ScrollView>
		</KeyboardAvoidingView>
	)
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { padding: 16, gap: 12 },
	subtitle: { marginBottom: 8 },
	section: { gap: 8 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	connectedHost: { marginLeft: 'auto' },
	labelSpacer: { marginTop: 8 },
	input: {
		backgroundColor: 'rgba(0, 20, 40, 0.5)',
		color: colors.text,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: 4,
		paddingHorizontal: 10,
		paddingVertical: 8,
		fontSize: 14,
		fontFamily: Platform.select({
			ios: 'Menlo',
			android: 'monospace',
			default: 'monospace',
		}),
	},
	inputMulti: { minHeight: 60, textAlignVertical: 'top' },
	button: {
		marginTop: 8,
		backgroundColor: colors.cyan,
		borderRadius: 4,
		paddingVertical: 12,
		alignItems: 'center',
	},
	buttonDisabled: { opacity: 0.5 },
	buttonGhost: {
		backgroundColor: 'transparent',
		borderColor: colors.border,
		borderWidth: 1,
	},
	buttonLabel: { color: colors.bg, fontSize: 12, letterSpacing: 2 },
	error: { color: colors.err, marginTop: 4 },
	hint: { color: colors.textDim, marginTop: 8, fontSize: 12, lineHeight: 18 },
})
