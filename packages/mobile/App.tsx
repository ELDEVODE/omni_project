import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { ChatScreen } from './src/screens/ChatScreen.tsx'
import { JoinScreen } from './src/screens/JoinScreen.tsx'
import { ModelsScreen } from './src/screens/ModelsScreen.tsx'
import { SettingsScreen } from './src/screens/SettingsScreen.tsx'
import { StatusScreen } from './src/screens/StatusScreen.tsx'
import { VoiceScreen } from './src/screens/VoiceScreen.tsx'
import { MeshProvider, useMesh } from './src/state.tsx'
import { HudLabel, StatusDot, colors } from './src/ui/Hud.tsx'
import { TabBar, type TabId } from './src/ui/TabBar.tsx'

export default function App() {
	return (
		<MeshProvider>
			<SafeAreaView>
				<Shell />
				<StatusBar style="light" />
			</SafeAreaView>
		</MeshProvider>
	)
}

function Shell() {
	const [tab, setTab] = useState<TabId>('join')
	const { status } = useMesh()
	const kind: 'ok' | 'warn' | 'err' | 'idle' =
		status === 'online'
			? 'ok'
			: status === 'connecting'
				? 'warn'
				: status === 'offline'
					? 'err'
					: 'idle'

	return (
		<View style={styles.shell}>
			<View style={styles.header}>
				<View style={styles.headerLeft}>
					<Text style={styles.logo}>OMNIMESH</Text>
					<HudLabel>phone compute node</HudLabel>
				</View>
				<View style={styles.headerRight}>
					<StatusDot status={kind} />
					<HudLabel style={styles.headerStatus}>
						{status.toUpperCase()}
					</HudLabel>
				</View>
			</View>
			<View style={styles.body}>
				{tab === 'join' ? <JoinScreen /> : null}
				{tab === 'status' ? <StatusScreen /> : null}
				{tab === 'chat' ? <ChatScreen /> : null}
				{tab === 'voice' ? <VoiceScreen /> : null}
				{tab === 'models' ? <ModelsScreen /> : null}
				{tab === 'settings' ? <SettingsScreen /> : null}
			</View>
			<TabBar active={tab} onSelect={setTab} />
		</View>
	)
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: colors.bg },
	shell: { flex: 1 },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderBottomColor: colors.border,
		borderBottomWidth: 1,
	},
	headerLeft: { flex: 1 },
	headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
	headerStatus: { marginLeft: 4 },
	logo: {
		color: colors.cyan,
		fontSize: 18,
		fontWeight: '700',
		letterSpacing: 3,
	},
	body: { flex: 1 },
})
