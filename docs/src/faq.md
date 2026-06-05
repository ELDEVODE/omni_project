---
title: FAQ
order: 6
group: Support
description: Frequently asked questions about OmniMesh.
---

# FAQ

### Do I need the QVAC SDK?

No. The host, worker, and mobile app all boot in **relay-only** mode
without it. Install with `bun add @qvac-sdk/qvac-sdk` to enable
model loading, inference delegation, the model registry, and asset
streaming.

### Why is the OpenAI endpoint on port 11434?

That's Ollama's default. It means a working `openai.base_url` config
for Continue.dev and Open WebUI can be reused verbatim. It is bound
to `127.0.0.1` by default; pass `--openai-host=0.0.0.0` to expose it.

### Does OmniMesh need the public internet?

No. mDNS handles LAN discovery. For cross-NAT, QVAC uses Hyperswarm
over **public relays** (`wss://relay-NN.qvac.ai`) for bootstrap, then
holepunches a direct connection. If you also firewall the relays,
OmniMesh degrades gracefully to "find peers manually" mode (the
`omni://` URI still works).

### How is auth done?

The host generates a 32-character base64url secret on first run and
stores it at `~/.omni/secret` (mode 0600). Workers authenticate to the
host by sending that secret in the `Authorization: Bearer ...` header
on the initial `HELLO`. The mobile app receives the secret via the
`omni://` URI. `omni rotate-secret` generates a new one and forces
all peers to reconnect.

For QVAC P2P, the per-call credential is the worker's
`providerPublicKey` (Hyperswarm hex pubkey). The host's
`firewall: { mode: 'allow', allowEmpty: true }` lets any provider
join; the host treats the publicKey as the authn principal.

### Where is the OpenAI-compat request actually executed?

The host's `/v1/chat/completions` handler picks the best worker with
the requested model loaded, then calls `QVACConsumer.completionStream`
on the host with `delegate: { providerPublicKey: <worker> }`. The
host is just a router; the inference runs on the worker. If no worker
has the model, the host falls back to its own provider (if loaded).

### Does the mobile app run on simulators?

QVAC requires a physical device for GPU compute. Use Expo Go on a real
iPhone (iOS 17+) or Android (12+). The mesh control plane *does* work
in the simulator; only the inference hot path is device-only.

### How do I add a model?

If the model is in the QVAC registry, just set it on the worker:

```ts
await sdk.loadModel({ modelId: 'llama-3-8b' })
```

The mesh's `model-registry.ts` will pull it from peers (or the public
registry) and stream it. The dashboard's **Models** panel shows
progress per node.

### Can I run OmniMesh on a Raspberry Pi?

Yes. Linux + arm64 is in the release matrix. Use `omni join` on the
Pi; it will boot a worker without a QVAC provider if the SDK isn't
installed (relay-only mode), or as a full worker if it is.

### What's the difference between `connected`, `relayed`, and `failed`?

`directConnect` is set by the `HeartbeatLoop` based on
`QVACConsumer.heartbeat({ delegate })` results:

- **connected** — Hyperswarm holepunch succeeded, RTT measured
- **relayed** — heartbeat reachable but the path goes through a
  public relay (NAT couldn't be punched)
- **failed** — peer didn't respond within `delegateTimeoutMs`; the
  router will skip this peer when picking a model host

### Where are the logs?

`omni host` and `omni join` write to `~/.omni/logs/`. The dashboard
streams the latest 200 lines via the `LOG` envelope.
