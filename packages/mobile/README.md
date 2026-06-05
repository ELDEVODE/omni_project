# @omnimesh/mobile

Native iOS / Android OmniMesh compute node. Runs QVAC SDK on device via Expo (Metal on iOS, Vulkan on Android).

## Status

**Phase 5 placeholder.** The mesh client scaffold is in `src/mesh/client.ts`; the QVAC wrapper is in `src/qvac.ts`. Full app — wake word, voice pipeline, models, mesh join screen — comes in Phase 6.

## Prerequisites (per QVAC docs)

- iOS 17+ with a **physical device** (QVAC does not run in the simulator)
- Android 12+ with a **physical device** (QVAC does not run in emulators)
- Node 22.17+ and Bun
- For iOS: Xcode + CocoaPods
- For Android: Android Studio + SDK + an Android device with USB debugging

## Setup

```bash
# From the monorepo root
bun install

# Prebuild the native projects
bunx expo prebuild --clean

# Run on a connected device
bunx expo run:ios --device
# or
bunx expo run:android --device
```

## Why a real native app (not a PWA)?

Per `qvac-docs.txt:85, 130-136, 245-257`:
- QVAC SDK runs natively on Node.js, Bare, and **Expo** (React Native)
- iOS uses **Metal** for GPU inference
- Android uses **Vulkan / OpenCL**
- WebGPU / WebLLM / browser-based inference is **not** part of the QVAC path

So the phone compute is always native, on-device, on the GPU. No browser shim.

## Wake word (Phase 6)

`omni wake-word` will hook openWakeWord into the Expo native module. Background audio mode is already configured in `app.json` (`UIBackgroundModes: ["audio"]` on iOS, foreground service on Android).
