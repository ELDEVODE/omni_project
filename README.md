# OmniMesh

> **Sovereign AI fabric** — turn your LAN into a private AI cluster. One command. Every device.

OmniMesh is a thin orchestration + visualization layer on top of [QVAC](https://qvac.tether.io) (Tether's local-first AI SDK). The mesh is real distributed compute: every node runs QVAC natively, models stream between devices, and the dashboard assigns work the way LM Studio does — but across N devices, not just one.

```
   ┌──────────────────────────┐
   │  omni host  (creator)    │   ← boots dashboard + mesh coordinator
   │  + QVAC (LLM + TTS)      │
   └────────────┬─────────────┘
                │  mDNS / QVAC P2P
   ┌────────────┼────────────┬──────────────┐
   ▼            ▼            ▼              ▼
 Mac Mini    Linux Box    iPhone (Expo)  Android (Expo)
 QVAC        QVAC         QVAC (Metal)   QVAC (Vulkan)
```

## Quickstart

```bash
# Install (macOS / Linux)
curl -fsSL https://omnimesh.github.io/omni/install.sh | bash

# Install (Windows PowerShell)
iwr -useb https://omnimesh.github.io/omni/install.ps1 | iex

# Or with Bun (dev)
bun install --frozen-lockfile
bun run packages/cli/src/index.ts host
```

Then scan the QR code printed in the terminal with your phone, and your phone becomes a node in the mesh.

> Docs: <https://omnimesh.github.io/omni/> — [Architecture](#built-on-qvac), [Quickstart](https://omnimesh.github.io/omni/quickstart.html), [Deployment](https://omnimesh.github.io/omni/deployment.html), [FAQ](https://omnimesh.github.io/omni/faq.html).

## Architecture

| Package | Role |
|---|---|
| [`packages/cli`](packages/cli) | `omni` binary — host, join, doctor, chat, rotate-secret |
| [`packages/host`](packages/host) | Mesh coordinator + QVAC orchestrator + dashboard server |
| [`packages/worker`](packages/worker) | Worker agent — joins a mesh, advertises capabilities, runs QVAC |
| [`packages/web`](packages/web) | React dashboard (the LM-Studio-style UI) |
| [`packages/mobile`](packages/mobile) | Expo + QVAC app — native iOS/Android compute nodes |
| [`packages/protocol`](packages/protocol) | Shared TypeScript types for mesh envelopes, capabilities, intents |

The full architecture is in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (TBD Phase 7).

## Built on QVAC

OmniMesh uses **every** QVAC capability. From the docs:

- **14 AI tasks**: LLM, embeddings, RAG, fine-tuning, multimodal, image gen, video gen, ASR, TTS, voice assistant, translation, VLA, OCR, image classification
- **3 P2P primitives**: delegated inference, model fetch from peers, blind relays for NAT traversal
- **6 runtime utilities**: logging, profiler, download lifecycle, runtime lifecycle, cancellation, sharded models
- **Distributed model registry**: models stream between nodes via QVAC's registry, no central server
- **OpenAI-compatible HTTP server**: any OpenAI client can talk to a mesh node directly
- **Expo runtime**: QVAC runs natively on iOS / Android — Metal on iOS, Vulkan on Android

### Phase 7R: full QVAC P2P rewrite

The mesh control plane is intentionally small — just presence, capability gossip, and dashboard intents. Everything model-related flows through QVAC's P2P layer:

| Layer | Path |
| --- | --- |
| Mesh presence | `HELLO` / `HELLO_ACK` / `BYE` / `PING` / `PONG` / `CAPS_UPDATE` / `PEER_UPDATE` |
| Provider liveness | `HEARTBEAT` / `HEARTBEAT_ACK` (5s tick, drives `directConnect: connected\|relayed\|failed` in the UI) |
| Inference | `loadModel({ delegate: { providerPublicKey, timeout, fallbackToLocal: true } })` + `completion()` / `completionStream()` over Hyperswarm |
| Model discovery | `modelRegistryList()` / `modelRegistrySearch()` / `modelRegistryGetModel()` |
| Asset download | `downloadAsset({ assetSrc, onProgress })` between workers, never via host |
| Lifecycle | `suspend()` / `resume()` on mobile `AppState` background/foreground |

The host stays WebSocket-only and is now a thin bridge: WS for control/auth/mDNS/dashboard, QVAC for inference routing. Every worker runs `startQVACProvider({ firewall })`. The phone runs `loadModel({ delegate })` directly to whichever worker has the model — bypassing the host on the inference hot path. The dashboard has a live **P2P** panel and an **OpenAI** panel (port 11434, curl-ready).

`qvac.config.json` is read by the host, every worker, and the mobile app:

```json
{
  "swarmRelays": ["wss://relay-01.qvac.ai", "wss://relay-02.qvac.ai", "wss://relay-03.qvac.ai"],
  "cacheDirectory": "~/.qvac/models",
  "registryDownloadMaxRetries": 3,
  "httpConnectionTimeoutMs": 10000,
  "httpDownloadConcurrency": 4,
  "delegateTimeoutMs": 30000,
  "loggerLevel": "info"
}
```

## Why this exists

Modern AI is centralized, high-latency, and dependent on the global internet. You don't own your intelligence; you rent it. OmniMesh is the opposite: decentralized, air-gapped, sovereign.

> **"Data never leaves your local network. No external API keys required."**
> 
> *"I am not a user of AI; I am the operator of my own private AI node."*

## Development

```bash
bun install --frozen-lockfile
bun run dev          # boots host + worker + web in parallel
bun run typecheck    # tsc across all packages
bun run lint         # biome
bun run test         # bun test
bun run docs:build   # regenerates the docs site
```

## Community

- [CONTRIBUTING.md](CONTRIBUTING.md) — fork, branch, PR model
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Contributor Covenant v2.1
- [SECURITY.md](SECURITY.md) — vulnerability disclosure (→ elpraise20@gmail.com, 90-day)
- [LICENSE](LICENSE) — MIT


Per-package dev:
```bash
bun run dev:host     # mesh coordinator only
bun run dev:worker   # worker only
bun run dev:web      # vite dashboard only
```

## Roadmap

- [x] **Phase 0** — Monorepo reshape (this commit)
- [x] **Phase 1** — `omni host` + `omni join` with mDNS discovery
- [x] **Phase 2** — Workload assignment (pick model → run on node)
- [x] **Phase 3** — LM Studio-style dashboard (all 18 tabs)
- [x] **Phase 3.5** — Shared-secret auth (token in URL, `~/.omni/secret`, `omni rotate-secret`)
- [x] **Phase 4** — QVAC P2P fallback (Hyperswarm via Holepunch + omni:// pairing URIs)
- [x] **Phase 5** — Phone Expo app (iOS + Android, relay-only mode without QVAC SDK)
- [x] **Phase 6** — Voice + wake word ("Hey omni" per-node opt-in, ASR → LLM → TTS pipeline)
- [x] **Phase 7R** — Full QVAC P2P rewrite (Hyperswarm-delegated inference, distributed model registry, OpenAI-compat endpoint, `qvac.config.json`, slim envelope protocol)
- [ ] **Phase 8** — Open-source polish (docs, releases, install.sh)

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) (TBD) for the full design.

## License

MIT
