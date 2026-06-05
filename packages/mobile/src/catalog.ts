// Mobile-friendly model catalog. The phone itself runs QVAC SDK for local
// inference on small models (e.g. whisper-tiny, llama-1b). Larger models
// are pulled onto desktop workers via the host's POST /api/models/pull.

import type { ModelSpec } from '@omnimesh/protocol'

export const PHONE_MODELS: ModelSpec[] = [
	{
		id: 'llama-3.2-1b-instruct-q4',
		kind: 'llm',
		name: 'Llama 3.2 1B Instruct (Q4)',
		modalities: ['text'],
		sizeBytes: 750_000_000,
		source: 'qvac://llama-3.2-1b-instruct-q4',
		minRamGb: 2,
	},
	{
		id: 'whisper-tiny-en-q4',
		kind: 'asr',
		name: 'Whisper Tiny English (Q4)',
		modalities: ['audio'],
		sizeBytes: 80_000_000,
		source: 'qvac://whisper-tiny-en-q4',
		minRamGb: 1,
	},
	{
		id: 'kokoro-tts-tiny-v1',
		kind: 'tts',
		name: 'Kokoro TTS Tiny',
		modalities: ['text', 'audio'],
		sizeBytes: 100_000_000,
		source: 'qvac://kokoro-tts-tiny-v1',
		minRamGb: 1,
	},
]
