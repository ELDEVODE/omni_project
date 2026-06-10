import { existsSync } from 'node:fs'
import path from 'node:path'
import { log } from '../log.ts'
import type { QVACSDK } from './types.ts'

let cachedSDK: QVACSDK | null | undefined = undefined

function getGlobalRoot(): string | null {
  try {
    const r = Bun.spawnSync({
      cmd: ['npm', 'root', '-g'],
      env: process.env,
      timeout: 3_000,
    })
    if (r.exitCode !== 0) return null
    return new TextDecoder().decode(r.stdout).trim() || null
  } catch {
    return null
  }
}

async function tryLoadFrom(modPath: string): Promise<QVACSDK | null> {
  try {
    const mod = await import(modPath)
    return (mod.default ?? mod) as QVACSDK
  } catch {
    return null
  }
}

export async function loadQVACSDK(): Promise<QVACSDK | null> {
  if (cachedSDK !== undefined) return cachedSDK

  // 1. Try standard resolution (works in dev, fails in compiled binary)
  let sdk = await tryLoadFrom('@qvac/sdk')
  if (sdk) {
    cachedSDK = sdk
    return sdk
  }

  // 2. Try global npm install path
  const globalRoot = getGlobalRoot()
  if (globalRoot) {
    const globalPath = path.join(globalRoot, '@qvac', 'sdk')
    if (existsSync(path.join(globalPath, 'package.json'))) {
      sdk = await tryLoadFrom(globalPath)
      if (sdk) {
        cachedSDK = sdk
        return sdk
      }
    }
  }

  // 3. Try local node_modules relative to cwd
  const localPath = path.join(process.cwd(), 'node_modules', '@qvac', 'sdk')
  if (existsSync(path.join(localPath, 'package.json'))) {
    sdk = await tryLoadFrom(localPath)
    if (sdk) {
      cachedSDK = sdk
      return sdk
    }
  }

  log.warn(
    '@qvac/sdk not loadable in compiled binary. Run from project source or use `omni install qvac` + a Node-based host wrapper for P2P mesh features. Dashboard, API, and OpenAI server work without it.',
  )
  cachedSDK = null
  return null
}
