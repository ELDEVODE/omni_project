---
title: Overview
order: 1
group: Get started
description: OmniMesh is a decentralized, air-gappable AI mesh that runs on every node.
---

# OmniMesh

A decentralized, air-gappable AI mesh. **Every node — desktop, laptop, or phone —
is both a coordinator and a worker.** QVAC's Hyperswarm P2P layer connects them
without a central server, and the dashboard, CLI, and OpenAI-compat endpoint stay
close to the data you already have.

```bash
curl -fsSL https://omnimesh.github.io/omni/install.sh | bash
omni doctor
omni host
```

## What's in the box

- **`omni host`** — boots a mesh coordinator on `:3005` (dashboard + WebSocket
  control plane) and an OpenAI-compatible endpoint on `:11434`. Uses mDNS to
  advertise itself to local peers and QVAC Hyperswarm to find remote ones.
- **`omni join`** — runs on every other machine. Boots a QVAC provider, loads
  models, and serves inference requests directly to peers.
- **`omni://` pairing** — one QR code or clickable URL. The mobile Expo app
  scans it and joins the mesh in seconds.
- **OpenAI-compat** — any OpenAI Python / curl / Continue.dev / Open WebUI
  client can talk to a mesh node. The host's own QVAC provider acts as a
  fallback when no worker has the requested model.
- **Voice + wake word** — "Hey omni" (openWakeWord) per-node opt-in.
  Pipeline: `oww → asr → qvac llm → tts` with on-device fallback.
- **Phone client** — iOS / Android Expo app. Uses QVAC to delegate inference
  directly to whichever worker has the model; falls back to relay-only mode
  on devices without the QVAC SDK.

## Why

Modern AI is centralized, high-latency, and dependent on the global internet.
You don't own your intelligence; you rent it. OmniMesh is the opposite:
decentralized, low-latency, sovereign. The mesh lives where your data lives.

## License

MIT. See [LICENSE](https://github.com/omnimesh/omni/blob/main/LICENSE).
