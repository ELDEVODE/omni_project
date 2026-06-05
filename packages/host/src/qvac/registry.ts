// Lightweight wrapper around @qvac/sdk's distributed model registry.
// Returns a stable local shape so the dashboard can render a catalog
// without a hard dep on the SDK at compile time.

import type { QVACSDK } from './types.ts'

export interface RegistryEntry {
	id: string
	name: string
	kind: string
	modalities: string[]
	sizeBytes: number
	source: string
	minRamGb: number
	minVramGb?: number
	description?: string
}

export class ModelRegistry {
	private cache: RegistryEntry[] | null = null
	private cacheExpiresAt = 0

	constructor(private sdk: QVACSDK | null) {}

	async list(): Promise<RegistryEntry[]> {
		if (this.cache && Date.now() < this.cacheExpiresAt) return this.cache
		if (!this.sdk?.modelRegistryList) {
			this.cache = []
			this.cacheExpiresAt = Date.now() + 30_000
			return this.cache
		}
		try {
			const entries = await this.sdk.modelRegistryList()
			this.cache = entries.map((e) => ({
				id: e.id,
				name: e.name ?? e.id,
				kind: e.kind ?? 'llm',
				modalities: e.modalities ?? ['text'],
				sizeBytes: e.sizeBytes ?? 0,
				source: e.source ?? e.id,
				minRamGb: e.minRamGb ?? 0,
				...(e.minVramGb !== undefined ? { minVramGb: e.minVramGb } : {}),
				description: e.description,
			}))
			this.cacheExpiresAt = Date.now() + 30_000
			return this.cache
		} catch {
			this.cache = []
			this.cacheExpiresAt = Date.now() + 30_000
			return this.cache
		}
	}

	async search(query: {
		kind?: string
		quantization?: string
		addon?: string
	}): Promise<RegistryEntry[]> {
		if (!this.sdk?.modelRegistrySearch) {
			const all = await this.list()
			if (!query.kind) return all
			return all.filter((m) => m.kind === query.kind)
		}
		try {
			const entries = await this.sdk.modelRegistrySearch(query)
			return entries.map((e) => ({
				id: e.id,
				name: e.name ?? e.id,
				kind: e.kind ?? 'llm',
				modalities: e.modalities ?? ['text'],
				sizeBytes: e.sizeBytes ?? 0,
				source: e.source ?? e.id,
				minRamGb: e.minRamGb ?? 0,
				...(e.minVramGb !== undefined ? { minVramGb: e.minVramGb } : {}),
				description: e.description,
			}))
		} catch {
			return []
		}
	}

	async get(id: string): Promise<RegistryEntry | null> {
		if (!this.sdk?.modelRegistryGetModel) {
			const all = await this.list()
			return all.find((m) => m.id === id) ?? null
		}
		try {
			const e = await this.sdk.modelRegistryGetModel(id)
			if (!e) return null
			return {
				id: e.id,
				name: e.name ?? e.id,
				kind: e.kind ?? 'llm',
				modalities: e.modalities ?? ['text'],
				sizeBytes: e.sizeBytes ?? 0,
				source: e.source ?? e.id,
				minRamGb: e.minRamGb ?? 0,
				...(e.minVramGb !== undefined ? { minVramGb: e.minVramGb } : {}),
				description: e.description,
			}
		} catch {
			return null
		}
	}
}
