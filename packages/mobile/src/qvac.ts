// QVAC SDK wrapper for the mobile app.
// Phase 5: the singleton that owns the QVAC runtime on the phone.

import type { completion, loadModel, textToSpeech, transcribe } from '@qvac/sdk'

type SDK = {
	loadModel: typeof loadModel
	completion: typeof completion
	textToSpeech: typeof textToSpeech
	transcribe: typeof transcribe
}

let sdk: SDK | null = null

export async function getSDK(): Promise<SDK> {
	if (sdk) return sdk
	// Dynamic import so the SDK native module loads only on devices that need it.
	const mod = await import(/* @vite-ignore */ '@qvac/sdk')
	sdk = {
		loadModel: mod.loadModel,
		completion: mod.completion,
		textToSpeech: mod.textToSpeech,
		transcribe: mod.transcribe,
	}
	return sdk
}
