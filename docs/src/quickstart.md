---
title: Quickstart
order: 2
group: Get started
description: Install omni, boot a host, join a worker, and run a request.
---

# Quickstart

## 1. Install

macOS / Linux:

```bash
curl -fsSL https://omnimesh.github.io/omni/install.sh | bash
```

Windows (PowerShell 5+):

```powershell
iwr -useb https://omnimesh.github.io/omni/install.ps1 | iex
```

The installer puts `omni` in `~/.local/bin` (or `%LOCALAPPDATA%\Programs\OmniMesh`
on Windows) and tells you how to add it to `PATH`.

If you already have a release tag in mind:

```bash
OMNI_VERSION=v0.1.0 curl -fsSL https://omnimesh.github.io/omni/install.sh | bash
```

## 2. Verify

```bash
omni doctor
```

`doctor` checks the runtime, platform, QVAC SDK resolution, secret file,
host HTTP port, OpenAI-compat port, ffmpeg, and current git SHA. Anything
red is broken; anything yellow is optional.

## 3. Boot the host

```bash
omni host
```

You'll see something like:

```
→ mesh on :3005
→ openai-compat on :11434
→ dashboard: http://127.0.0.1:3005/?token=abc...
→ qvac provider: 0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b...
→ scan: omni://studio.local?port=3005&token=abc&provider=0a1b...
```

Open the dashboard URL in a browser. The secret is stored in
`~/.omni/secret` (mode 0600) and shared automatically with workers.

## 4. Join a worker

On another machine:

```bash
omni join studio.local
```

Or with the secret explicitly:

```bash
omni join studio.local --secret=abc...
```

The worker publishes its own QVAC provider key, advertises via mDNS, and
joins the Hyperswarm topic. Inference requests are routed to it via QVAC
when a model is loaded.

## 5. Run an inference

OpenAI-compat:

```bash
curl http://127.0.0.1:11434/v1/chat/completions \
  -H "Authorization: Bearer abc..." \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3-8b","messages":[{"role":"user","content":"hi"}]}'
```

Mesh HTTP (host):

```bash
curl http://127.0.0.1:3005/api/infer \
  -H "Authorization: Bearer abc..." \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3-8b","prompt":"hi"}'
```

## 6. (Optional) phone

Build the Expo app:

```bash
cd packages/mobile
bun install --ignore-scripts
bunx expo start
```

Scan the QR code with Expo Go. The phone joins the mesh over mDNS (LAN)
or Hyperswarm (anywhere). Voice mode: "Hey omni" → ASR → LLM → TTS.
