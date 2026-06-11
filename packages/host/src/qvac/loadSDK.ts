import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { log } from '../log.ts'
import { tryNodeBridge } from './nodeBridge.ts'
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

function getEntryPath(packageDir: string): string {
	try {
		const pkgJsonPath = path.join(packageDir, 'package.json')
		const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
			main?: string
		}
		const main = pkg.main || './dist/index.js'
		return path.resolve(packageDir, main)
	} catch {
		return path.join(packageDir, 'dist/index.js')
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

function nodeOnPath(): boolean {
	try {
		const r = Bun.spawnSync({ cmd: ['node', '--version'], timeout: 3_000 })
		return r.exitCode === 0
	} catch {
		return false
	}
}

export async function loadQVACSDK(): Promise<QVACSDK | null> {
	if (cachedSDK !== undefined) return cachedSDK

	let sdkImportPath = '@qvac/sdk'

	// 1. Try standard resolution (works in dev, fails in compiled binary)
	let sdk = await tryLoadFrom(sdkImportPath)
	if (sdk) {
		cachedSDK = sdk
		return sdk
	}

	// 2. Try global npm install path
	const globalRoot = getGlobalRoot()
	if (globalRoot) {
		const globalPath = path.join(globalRoot, '@qvac', 'sdk')
		if (existsSync(path.join(globalPath, 'package.json'))) {
			const entry = getEntryPath(globalPath)
			sdk = await tryLoadFrom(entry)
			if (sdk) {
				cachedSDK = sdk
				return sdk
			}
			sdkImportPath = entry
		}
	}

	// 3. Try local node_modules relative to cwd
	const localPath = path.join(process.cwd(), 'node_modules', '@qvac', 'sdk')
	if (existsSync(path.join(localPath, 'package.json'))) {
		const entry = getEntryPath(localPath)
		sdk = await tryLoadFrom(entry)
		if (sdk) {
			cachedSDK = sdk
			return sdk
		}
		sdkImportPath = entry
	}

	// 4. Fallback: spawn Node child process bridge (works in compiled binary)
	if (nodeOnPath()) {
		log.info('Direct SDK import failed; trying Node child-process bridge…')
		const bridgeSDK = await tryNodeBridge(sdkImportPath)
		if (bridgeSDK) {
			log.info('QVAC SDK loaded via Node bridge')
			cachedSDK = bridgeSDK
			return bridgeSDK
		}
	}

	log.warn(
		'@qvac/sdk not loadable. Install Node.js and run `omni install qvac`, then restart. Dashboard, API, and OpenAI server work without it.',
	)
	cachedSDK = null
	return null
}
