export { LLAMA_3_2_1B_INST_Q4_0, QWEN3_600M_INST_Q4, TTS_EN_SUPERTONIC_Q8_0 } from '@qvac/sdk'

export const DEFAULT_MODEL_ALIASES = {
	'llama-3.2-1b': 'LLAMA_3_2_1B_INST_Q4_0',
	'qwen3-600m': 'QWEN3_600M_INST_Q4',
	whisper: 'WHISPER_TINY',
	tts: 'TTS_EN_SUPERTONIC_Q8_0',
} as const

export type ModelAlias = keyof typeof DEFAULT_MODEL_ALIASES