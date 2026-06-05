// Ambient types for @qvac/sdk so the rest of the codebase can
// typecheck against the SDK shape even when the package isn't installed
// (the SDK is an optional peer dependency). The real package, when
// present, augments this via module declaration merging below.

export type QVACModelSrc = string | { src: string; [k: string]: unknown }

export interface QVACDelegate {
	providerPublicKey: string
	timeout?: number
	fallbackToLocal?: boolean
}

export interface QVACLoadModelOptions {
	modelSrc: QVACModelSrc
	modelType?: string
	modelConfig?: Record<string, unknown>
	delegate?: QVACDelegate
}

export interface QVACCompletionOptions {
	modelId: string
	history?: { role: 'user' | 'assistant' | 'system'; content: string }[]
	prompt?: string
	stream?: boolean
	delegate?: QVACDelegate
}

export interface QVACCompletionEvent {
	type: 'contentDelta' | 'done' | 'error' | string
	text?: string
	delta?: string
	message?: string
}

export interface QVACCompletionResult {
	events: AsyncIterable<QVACCompletionEvent>
}

export interface QVACModelInfo {
	id: string
	name?: string
	kind?: string
	loaded?: boolean
}

export interface QVACProviderHandle {
	publicKey: string
	stop(): Promise<void>
}

export interface QVACStartProviderOptions {
	firewall?: {
		mode: 'allow' | 'block'
		publicKeys?: string[]
		allowEmpty?: boolean
	}
	loggerLevel?: 'debug' | 'info' | 'warn' | 'error'
	cacheDirectory?: string
	swarmRelays?: string[]
	seed?: string
}

export interface QVACRegistryEntry {
	id: string
	name: string
	kind: string
	modalities?: string[]
	quantization?: string
	addon?: string
	sizeBytes?: number
	minRamGb?: number
	minVramGb?: number
	source?: string
	description?: string
}

export interface QVACDownloadProgress {
	bytes: number
	total: number
	pct: number
	phase: 'downloading' | 'loading' | 'ready' | 'error'
	error?: string
}

export interface QVACAssetDownloadOptions {
	assetSrc: string
	onProgress?: (progress: QVACDownloadProgress) => void
}

export interface QVACSDK {
	LLAMA_3_2_1B_INST_Q4_0?: QVACModelSrc
	TTS_EN_SUPERTONIC_Q8_0?: { src: QVACModelSrc }
	loadModel(options: QVACLoadModelOptions): Promise<string>
	unloadModel(modelId: string): Promise<void>
	completion(options: QVACCompletionOptions): QVACCompletionResult
	heartbeat?(options: {
		delegate: QVACDelegate
		timeout?: number
	}): Promise<{ rttMs: number; reachable: boolean }>
	cancel?(options: {
		operation: 'completion' | 'download' | 'load'
		modelId?: string
		delegate?: QVACDelegate
	}): Promise<void>
	suspend?(): Promise<void>
	resume?(): Promise<void>
	getLoadedModelInfo?(): QVACModelInfo[]
	startQVACProvider?(
		options: QVACStartProviderOptions,
	): Promise<QVACProviderHandle>
	stopQVACProvider?(): Promise<void>
	modelRegistryList?(): Promise<QVACRegistryEntry[]>
	modelRegistrySearch?(query: {
		kind?: string
		quantization?: string
		addon?: string
	}): Promise<QVACRegistryEntry[]>
	modelRegistryGetModel?(id: string): Promise<QVACRegistryEntry | null>
	downloadAsset?(options: QVACAssetDownloadOptions): Promise<void>
}
