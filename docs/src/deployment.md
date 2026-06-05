---
title: Deployment
order: 4
group: Concepts
description: Running OmniMesh across NATs, exposing the dashboard, hardening auth.
---

# Deployment

OmniMesh has two transports for connecting workers and the host:

| Transport | Latency | Use case                          |
| --------- | ------- | --------------------------------- |
| QVAC P2P  | ~0 ms   | default; Hyperswarm DHT + relays  |
| mDNS      | ~1 ms   | LAN bootstrap (advertise + browse)|

Both run side-by-side. The mobile app uses mDNS first, then QVAC for
remote peers.

## Exposing the dashboard

The host's dashboard is on `:3005` by default. Three options for
remote access:

### Tailscale (recommended)

```bash
brew install tailscale
sudo tailscale up
omni host
# dashboard: http://100.x.y.z:3005/?token=...
```

Every worker on the tailnet reaches the host over a stable IP, no
port forwarding. Auth is still enforced by the shared secret.

### ngrok / Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3005
```

Useful for quick sharing of a dashboard URL. The OpenAI-compat endpoint
on `:11434` is a separate tunnel:

```bash
cloudflared tunnel --url http://localhost:11434
```

### Public port forwarding

If you must, point your router at `:3005`. **Do not** put it on the
public internet without a strong secret — `omni rotate-secret` will
generate one for you.

## Cross-NAT with QVAC

QVAC uses Hyperswarm's holepunch with the three public relays defined
in `qvac.config.json`. Workers behind symmetric NAT fall back to the
relays. The `directConnect` field in `PeerInfo` tells you whether the
path is holepunched (`connected`) or relayed (`relayed`).

The host advertises a `firewall: { mode: 'allow', allowEmpty: true }` so
bootstrapping works out of the box. Authentication is per-call via the
worker's `providerPublicKey`, not a static allowlist.

## Mobile deployment

- **iOS 17+ / Android 12+** (QVAC physical device only; no simulator)
- Build with EAS: `bunx eas build --platform ios`
- The mobile app needs network discovery and microphone permissions
- `qvac.config.json` is read from the app's `assets/` directory at
  build time

## Hardening

- `omni rotate-secret` — rotate the dashboard auth token
- Run the host on a private network; never expose without a secret
- The mDNS TXT record carries the secret in clear; this is fine on
  trusted LANs but is the reason public exposure requires Tailscale
  or similar
- The OpenAI-compat endpoint on `:11434` defaults to `127.0.0.1`-only;
  pass `--openai-host=0.0.0.0` (host) to expose it

## Logs

`omni host` and `omni join` both log to `~/.omni/logs/`. The dashboard
shows live logs streamed via the `LOG` envelope.
