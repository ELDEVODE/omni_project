// Bottom tab navigation — Join / Status / Chat / Voice / Models / Settings.

import { Pressable, StyleSheet, Text, View } from 'react-native'

export type TabId = 'join' | 'status' | 'chat' | 'voice' | 'models' | 'settings'

const TABS: { id: TabId; label: string }[] = [
	{ id: 'join', label: 'JOIN' },
	{ id: 'status', label: 'STATUS' },
	{ id: 'chat', label: 'CHAT' },
	{ id: 'voice', label: 'VOICE' },
	{ id: 'models', label: 'MODELS' },
	{ id: 'settings', label: 'SETTINGS' },
]

export function TabBar({
	active,
	onSelect,
}: { active: TabId; onSelect: (id: TabId) => void }) {
	return (
		<View style={styles.bar}>
			{TABS.map((tab) => {
				const isActive = active === tab.id
				return (
					<Pressable
						key={tab.id}
						style={[styles.tab, isActive && styles.tabActive]}
						onPress={() => onSelect(tab.id)}
					>
						<Text style={[styles.label, isActive && styles.labelActive]}>
							{tab.label}
						</Text>
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	bar: {
		flexDirection: 'row',
		backgroundColor: 'rgba(0, 12, 24, 0.95)',
		borderTopColor: 'rgba(0, 212, 255, 0.25)',
		borderTopWidth: 1,
	},
	tab: { flex: 1, alignItems: 'center', paddingVertical: 8 },
	tabActive: { backgroundColor: 'rgba(0, 212, 255, 0.1)' },
	label: {
		color: 'rgba(223, 244, 255, 0.55)',
		fontSize: 9,
		letterSpacing: 1.5,
		fontWeight: '600',
	},
	labelActive: { color: '#00d4ff' },
})
