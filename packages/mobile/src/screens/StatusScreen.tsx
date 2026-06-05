// Status screen — shows the mesh connection state, peer roster, and
// which models are loaded on which peer.

import type { PeerInfo } from '@omnimesh/protocol'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useMesh } from '../state.tsx'
import {
	HudBody,
	HudLabel,
	HudTitle,
	Panel,
	StatusDot,
	colors,
} from '../ui/Hud.tsx'

export function StatusScreen() {
	const { status, peers, nodeName, pairing } = useMesh()
	const statusKind: 'ok' | 'warn' | 'err' | 'idle' =
		status === 'online'
			? 'ok'
			: status === 'connecting'
				? 'warn'
				: status === 'offline'
					? 'err'
					: 'idle'

	return (
		<ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
			<HudTitle>STATUS</HudTitle>

			<Panel style={styles.section}>
				<View style={styles.row}>
					<StatusDot status={statusKind} />
					<HudLabel>{status.toUpperCase()}</HudLabel>
				</View>
				<HudBody>
					{pairing
						? `${pairing.meshName ?? 'mesh'} @ ${pairing.host}:${pairing.port}`
						: 'No host paired. Use the JOIN tab to connect.'}
				</HudBody>
				<HudBody style={styles.subtle}>Node: {nodeName}</HudBody>
			</Panel>

			<HudTitle style={styles.section}>PEERS</HudTitle>
			{peers.length === 0 ? (
				<Panel>
					<HudBody style={styles.subtle}>
						{status === 'online'
							? 'Connected. No other peers in the mesh yet.'
							: 'Not connected to a mesh.'}
					</HudBody>
				</Panel>
			) : (
				peers.map((peer) => (
					<PeerCard key={`peer-${peer.nodeId}`} peer={peer} />
				))
			)}
		</ScrollView>
	)
}

function PeerCard({ peer }: { peer: PeerInfo; key?: string }) {
	const ram = peer.caps.ram.totalGb
	const gpu = peer.caps.gpu?.name ?? peer.caps.gpu?.api
	const rtt = peer.heartbeatRttMs >= 0 ? `${peer.heartbeatRttMs} ms` : 'n/a'
	const dc = peer.directConnect === 'unknown' ? '—' : peer.directConnect
	return (
		<Panel style={styles.peerCard}>
			<View style={styles.row}>
				<HudBody style={styles.peerName}>{peer.name}</HudBody>
				<HudLabel>
					{peer.providerPublicKey
						? `QVAC ${peer.providerPublicKey.slice(0, 6)}…`
						: 'RELAY'}
				</HudLabel>
			</View>
			<HudLabel>
				{peer.caps.os}/{peer.caps.arch} • {ram} GB RAM {gpu ? `• ${gpu}` : ''}
			</HudLabel>
			{peer.currentModels.length > 0 ? (
				<HudBody style={styles.models}>
					models: {peer.currentModels.join(', ')}
				</HudBody>
			) : (
				<HudBody style={styles.subtle}>no models loaded</HudBody>
			)}
			<HudBody style={styles.subtle}>
				rtt {rtt} • direct {dc}
			</HudBody>
		</Panel>
	)
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { padding: 16, gap: 12 },
	section: { marginTop: 8 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	peerCard: { gap: 4 },
	peerName: { flex: 1 },
	models: { fontFamily: 'monospace' },
	subtle: { color: colors.textDim, fontSize: 12 },
})
