---
title: Architecture
order: 3
group: Concepts
description: How OmniMesh is wired together — the QVAC P2P layer, the mesh control plane, the mobile app, and the dashboard.
---

# Architecture

OmniMesh is a thin protocol on top of **QVAC** (Holepunch + Hyperswarm DHT).
The mesh control plane is intentionally small — presence, capability gossip,
and dashboard intents. Everything model-related flows through QVAC's P2P
layer.

## Layers

```text
┌──────────────────────────────────────────────────────────────┐
│  Dashboard (web)        Mobile (Expo)        OpenAI clients │
│  http://host:3005       iOS / Android        curl / SDKs    │
└──────┬──────────────────────┬────────────────────┬──────────┘
       │ WS control           │ WS control + QVAC  │ HTTP :11434
       ▼                      ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│  Host (omni host)                                              │
│  · WebSocket mesh hub          · Heartbeat loop (5s)        │
│  · mDNS advertiser             · Auth via shared secret     │
│  · OpenAI-compat (Bun.serve)   · WorkloadRouter (QVAC)       │
└──────┬───────────────────────────────────────┬──────────────┘
       │ QVAC P2P (Hyperswarm)                 │
       ▼                                       ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│  Worker (omni join)     │         │  Phone (omni mobile)    │
│  · QVACProvider         │         │  · QVACConsumer         │
│  · downloadAsset()      │         │  · delegate + heartbeat │
│  · modelRegistryList    │         │  · AppState lifecycle   │
└─────────────────────────┘         └─────────────────────────┘
```

## Wire envelopes

The mesh control plane has a small, fixed set of envelope types:

| Envelope            | Direction         | Purpose                                |
| ------------------- | ----------------- | -------------------------------------- |
| `HELLO` / `HELLO_ACK` | both            | identity, version, providerPublicKey   |
| `BYE`               | client → host     | clean shutdown                         |
| `PING` / `PONG`     | both              | keepalive                              |
| `HEARTBEAT` / `HEARTBEAT_ACK` | host → peer | drives `directConnect: connected\|relayed\|failed` |
| `CAPS_UPDATE`       | peer → host       | capability change (model loaded, etc.) |
| `PEER_UPDATE`       | host → peers      | peer roster (presence, models)         |
| `INTENT`            | dashboard → peer  | "show me view X"                       |
| `ADMIN`             | dashboard → host  | rotate secret, force rejoin, etc.      |
| `LOG`               | peer → host       | log line for the dashboard             |

Model pulls, model progress, inference requests, deltas, completion events
— **all** flow through QVAC's P2P layer (`loadModel` + `completion` /
`completionStream`). They are not mesh envelopes.

## PeerInfo

Every peer on the dashboard carries:

```ts
{
  nodeId: string
  name: string
  providerPublicKey: string   // Hyperswarm hex pubkey (or '' for dashboard-only)
  lastHeartbeatMs: number | null
  heartbeatRttMs: number      // -1 = not measured
  directConnect: 'unknown' | 'connected' | 'relayed' | 'failed'
  models: ModelSpec[]
  // ...capability flags
}
```

## QVAC P2P primitives used

- `startQVACProvider({ firewall, loggerLevel, cacheDirectory, swarmRelays, seed })`
- `stopQVACProvider()`
- `loadModel({ delegate: { providerPublicKey, timeout, fallbackToLocal: true } })`
- `completion({ modelId, history, delegate })`
- `completionStream({ modelId, history, delegate })` — async iterable of deltas
- `heartbeat({ delegate, timeout })` → `{ reachable, rttMs }`
- `modelRegistryList()` / `modelRegistrySearch()` / `modelRegistryGetModel()`
- `downloadAsset({ assetSrc, onProgress })`
- `suspend()` / `resume()` (mobile lifecycle)
- `cancel({ operation, modelId, delegate })`

## qvac.config.json

The config file is read by host, every worker, and the mobile app:

```json
{
  "swarmRelays": [
    "wss://relay-01.qvac.ai",
    "wss://relay-02.qvac.ai",
    "wss://relay-03.qvac.ai"
  ],
  "cacheDirectory": "~/.qvac/models",
  "registryDownloadMaxRetries": 3,
  "httpConnectionTimeoutMs": 10000,
  "httpDownloadConcurrency": 4,
  "delegateTimeoutMs": 30000,
  "loggerLevel": "info"
}
```

Resolution order: cwd → parent → grandparent → `~/.qvac/config.json`.

## Why QVAC

We needed *all* of: holepunched P2P, blind relays for NAT, a distributed
model registry, delegated inference, model asset streaming, and a
sharded-model download path that doesn't require a central server.
QVAC bundles them with one cohesive API. Building the same from raw
Hyperswarm + libp2p was a 6-month detour; QVAC gets us there in a weekend.
