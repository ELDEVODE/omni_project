// Stub for the optional @qvac/sdk peer dependency.
// When QVAC is installed, the real types from @qvac/sdk override these.

declare module '@qvac/sdk' {
	export const loadModel: (opts: {
		modelSrc: string | { src: string }
		modelType?: string
		modelConfig?: Record<string, unknown>
		onProgress?: (p: unknown) => void
	}) => Promise<string>

	export const unloadModel: (opts: { modelId: string }) => Promise<void>

	export const completion: (opts: {
		modelId: string
		history: Array<{ role: string; content: string }>
		stream?: boolean
	}) => {
		events: AsyncIterable<{ type: string; text?: string; [k: string]: unknown }>
		tokenStream?: AsyncIterable<string>
	}

	export const textToSpeech: (opts: {
		modelId: string
		text: string
		inputType?: string
		stream?: boolean
	}) => Promise<{ buffer: ArrayBuffer }>

	export const transcribe: (opts: {
		modelId: string
		audioChunk: Buffer | Uint8Array | string
	}) => Promise<string>

	export const LLAMA_3_2_1B_INST_Q4_0: string
	export const PARAKEET_CTC_0_6B_Q8_0: string
	export const TTS_EN_SUPERTONIC_Q8_0: { src: string }
	export const QWEN3_600M_INST_Q4: string

	const _default: Record<string, unknown>
	export default _default
}

declare module '@qvac/sdk/expo-plugin' {
	const plugin: unknown
	export default plugin
}
