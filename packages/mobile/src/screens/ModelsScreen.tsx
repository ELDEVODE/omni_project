// Models screen — list models loaded on the mesh, plus the local
// phone-friendly models that could be pulled onto the device.

import { ScrollView, StyleSheet } from 'react-native'
import { PHONE_MODELS } from '../catalog.ts'
import { useMesh } from '../state.tsx'
import { HudBody, HudLabel, HudTitle, Panel, colors } from '../ui/Hud.tsx'

export function ModelsScreen() {
	const { peers, status } = useMesh()
	const loaded = peers.flatMap((p) =>
		p.currentModels.map((m) => ({ model: m, peer: p.name })),
	)
	const unique = new Map<string, { model: string; peers: string[] }>()
	for (const { model, peer } of loaded) {
		const cur = unique.get(model) ?? { model, peers: [] }
		cur.peers.push(peer)
		unique.set(model, cur)
	}
	const allLoaded = Array.from(unique.values())

	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
			<HudTitle>MODELS</HudTitle>

			<HudTitle style={styles.section}>MESH ({allLoaded.length})</HudTitle>
			{allLoaded.length === 0 ? (
				<Panel>
					<HudBody style={styles.subtle}>
						{status === 'online'
							? 'No models loaded. Pull one from the host with `omni host` and click Pull on a worker.'
							: 'Not connected to a mesh.'}
					</HudBody>
				</Panel>
			) : (
				allLoaded.map((m) => (
					<Panel key={m.model} style={styles.card}>
						<HudBody style={styles.name}>{m.model}</HudBody>
						<HudLabel>on {m.peers.join(', ')}</HudLabel>
					</Panel>
				))
			)}

			<HudTitle style={styles.section}>PHONE ({PHONE_MODELS.length})</HudTitle>
			{PHONE_MODELS.map((m) => (
				<Panel key={m.id} style={styles.card}>
					<HudBody style={styles.name}>{m.name}</HudBody>
					<HudLabel>
						{m.kind} • {Math.round(m.sizeBytes / 1_000_000)} MB • min{' '}
						{m.minRamGb} GB RAM
					</HudLabel>
				</Panel>
			))}
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { padding: 16, gap: 12 },
	section: { marginTop: 8 },
	card: { gap: 4 },
	name: { fontWeight: '600' },
	subtle: { color: colors.textDim, fontSize: 12 },
})
