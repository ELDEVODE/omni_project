// Mesh client for the phone. Connects to the OmniMesh host over WebSocket
// and exposes the slim Phase 7R control plane (HELLO, HELLO_ACK,
// BYE, PING/PONG, CAPS_UPDATE, PEER_UPDATE, HEARTBEAT,
// HEARTBEAT_ACK, INTENT, ADMIN, LOG). The phone is itself a QVAC
// consumer when the SDK is installed — inference is delegated
// directly to a worker via loadModel({ delegate: { providerPublicKey } }).

import type { CapsReport, Envelope, PeerInfo } from '@omnimesh/protocol'

export type MeshStatus = 'idle' | 'connecting' | 'online' | 'offline'

export type MeshClientOptions = {
	host: string
	port: number
	name: string
	caps: CapsReport
	token: string
	providerKey?: string
	reconnectMs?: number
}

export type MeshClientEvents = {
	onMessage?: (env: Envelope) => void
	onStatus?: (status: MeshStatus) => void
	onPeers?: (peers: PeerInfo[]) => void
}

export class MeshClient {
	private ws: WebSocket | null = null
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private status: MeshStatus = 'idle'
	private peers: PeerInfo[] = []
	private nodeId: string
	private opts: MeshClientOptions
	private events: MeshClientEvents

	constructor(opts: MeshClientOptions, events: MeshClientEvents = {}) {
		this.opts = opts
		this.events = events
		this.nodeId = randomId()
	}

	connect(): void {
		if (this.status === 'connecting' || this.status === 'online') return
		const proto =
			this.opts.host === 'localhost' || /^\d+\./.test(this.opts.host)
				? 'ws'
				: 'wss'
		const url = `${proto}://${this.opts.host}:${this.opts.port}/ws?token=${encodeURIComponent(this.opts.token)}`
		this.setStatus('connecting')
		try {
			this.ws = new WebSocket(url)
		} catch (err) {
			console.warn('[mesh] failed to open WebSocket:', (err as Error).message)
			this.scheduleReconnect()
			return
		}
		this.ws.onopen = () => {
			this.setStatus('online')
			const hello: Envelope = {
				type: 'HELLO',
				nodeId: this.nodeId,
				name: this.opts.name,
				caps: this.opts.caps,
				...(this.opts.providerKey
					? { providerPublicKey: this.opts.providerKey }
					: {}),
			}
			this.send(hello)
		}
		this.ws.onmessage = (e) => {
			try {
				const env = JSON.parse(String(e.data)) as Envelope
				if (env.type === 'HELLO_ACK' || env.type === 'PEER_UPDATE') {
					this.peers = env.peers
					this.events.onPeers?.(this.peers)
				}
				this.events.onMessage?.(env)
			} catch {
				// ignore malformed
			}
		}
		this.ws.onerror = () => {
			this.ws?.close()
		}
		this.ws.onclose = () => {
			this.setStatus('offline')
			this.scheduleReconnect()
		}
	}

	send(env: Envelope): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(env))
		}
	}

	disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		if (this.ws) {
			const bye: Envelope = {
				type: 'BYE',
				nodeId: this.nodeId,
				reason: 'shutdown',
			}
			try {
				if (this.ws.readyState === WebSocket.OPEN)
					this.ws.send(JSON.stringify(bye))
			} catch {
				// ignore
			}
			this.ws.close()
			this.ws = null
		}
		this.setStatus('offline')
	}

	getNodeId(): string {
		return this.nodeId
	}

	getPeers(): PeerInfo[] {
		return this.peers
	}

	getStatus(): MeshStatus {
		return this.status
	}

	private setStatus(next: MeshStatus): void {
		if (this.status === next) return
		this.status = next
		this.events.onStatus?.(next)
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) return
		const delay = this.opts.reconnectMs ?? 3000
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null
			this.connect()
		}, delay)
	}
}

function randomId(): string {
	// crypto.randomUUID is available on modern React Native.
	return crypto.randomUUID()
}
