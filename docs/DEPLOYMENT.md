# OmniMesh Cross-NAT Deployment

OmniMesh has two transports for connecting workers and the host:

| Transport | Latency | Use case |
|-----------|---------|----------|
| **Relay** (WebSocket through host) | +1 hop | LAN + same-network, simplest setup |
| **P2P** (QVAC Hyperswarm via Holepunch) | direct, NAT-traversed | Cross-NAT, mobile-to-desktop, low-latency |

The host always runs the relay. Workers can additionally expose a Hyperswarm
public key (when `@qvac/sdk` is installed and a QVAC provider is started), at
which point other workers can connect to them **directly** over the DHT.

## Modes

1. **Same LAN** — Workers discover the host via mDNS (`_omni-mesh._tcp`) and
   connect to its local IP. Zero config. The default.

2. **Public host** — Expose the host port to the internet (Tailscale,
   ngrok, Cloudflare Tunnel, or a static public IP). Workers connect
   from anywhere with `omni join omni://<public-host>:443?token=…`.

3. **P2P mesh** — Each worker that has `@qvac/sdk` installed exposes a
   Hyperswarm key. Other workers can dial that key directly via
   `loadModel({ delegate: { providerPublicKey } })`, bypassing the host
   entirely. The host still acts as the discovery / coordination plane.

## Public host: Tailscale

Tailscale gives every device a stable `100.x.y.z` IP and a MagicDNS name
(`mybox.tail-net.ts.net`). Both are reachable from any other Tailscale node
without port forwarding.

```bash
# On the host
tailscale up
omni host --public=$(tailscale ip -4):3005

# On a worker (anywhere in your tailnet)
omni join omni://$(tailscale status --json | jq -r '.Self.DNSName' | sed 's/.$//'):3005?token=...
```

## Public host: ngrok

Quick way to expose a local host to the internet without configuring
firewalls. Good for demos, not for production.

```bash
ngrok tcp 3005
# Returns: tcp://0.tcp.ngrok.io:12345

# Tell the host to advertise that as its public endpoint
omni host --public=0.tcp.ngrok.io:12345
```

## Public host: Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3005
# Returns: https://<random>.trycloudflare.com

omni host --public=<random>.trycloudflare.com:443
```

Workers then connect with:
```bash
omni join omni://<random>.trycloudflare.com?port=443&token=...
```

## P2P mesh

When the QVAC SDK is installed on a worker, `startQVACProvider()` is
called automatically. The worker learns its Hyperswarm public key and
publishes it to the host as part of HELLO. The host includes it in
`PeerInfo.p2pKey` and the consumer-side workers can use it to call
`loadModel({ delegate: { providerPublicKey } })` for direct delegated
inference.

In the MVP dashboard you don't have to do anything special — the relay
is always used. Direct P2P delegation is wired through the QVAC SDK
transparently.

## Authentication

All transports (relay WS, P2P delegated calls) are protected by the
shared secret stored in `~/.omni/secret`. The secret travels in the
WS URL as `?token=…` or in the `Authorization: Bearer` header. For P2P
calls, the QVAC SDK uses Hyperswarm's secure noise channels
(`dht.connect(publicKey)` is encrypted end-to-end).

Rotate the secret at any time:
```bash
omni rotate-secret --host=http://127.0.0.1:3005
# Existing peers must reconnect with the new token.
```

## Troubleshooting

- **Worker can't find host via mDNS**: Use `omni join <ip>` instead.
- **Connection refused from internet**: Check firewall / NAT. Use
  Tailscale or ngrok to bypass port forwarding.
- **P2P connection stalls**: Cold-DHT bootstrap takes 15–45s on first
  call. Subsequent calls are sub-second. Configure `QVAC_HYPERSWARM_SEED`
  for reproducible identities across restarts.
- **Stale secret after `rotate-secret`**: Reconnect all workers and
  refresh the dashboard URL.

## Architecture

```
                ┌──────────────────────────┐
   ┌────────┐   │                          │   ┌────────┐
   │ phone  │──►│  host (relay + P2P relay │◄──│  desktop│
   │ worker │   │   + dashboard + storage) │   │  worker │
   └────┬───┘   │                          │   └───┬────┘
        │       │  3005 (WS+HTTP), mDNS,   │       │
        │       │  P2P via Hyperswarm DHT  │       │
        │       └────────┬─────────────────┘       │
        │                │                         │
        │       ┌────────▼─────────────────┐       │
        └──────►│ worker-2 (P2P-capable)   │◄──────┘
                │  Hyperswarm public key   │
                │  dht.connect(key) direct │
                └──────────────────────────┘
```
