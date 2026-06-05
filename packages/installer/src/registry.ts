// Single source of truth for installable capabilities. The CLI
// lists from this registry, the host's install dispatcher routes
// by name, and `omni doctor` checks the same names.

import {
	bonjour,
	ffmpeg,
	openwakeword,
	qvac,
	vulkan,
} from './capabilities/index.ts'
import type { Capability, InstallPlatform } from './types.ts'

const BUILTIN: Capability[] = [qvac, ffmpeg, vulkan, openwakeword, bonjour]

export class InstallerRegistry {
	private byName: Map<string, Capability>
	private ordered: Capability[]

	constructor(seed: Capability[] = BUILTIN) {
		this.byName = new Map()
		this.ordered = []
		for (const c of seed) this.register(c)
	}

	list(): Capability[] {
		return [...this.ordered]
	}

	names(): string[] {
		return this.ordered.map((c) => c.name)
	}

	get(name: string): Capability | undefined {
		return this.byName.get(name)
	}

	register(cap: Capability): void {
		if (this.byName.has(cap.name)) {
			const existing = this.byName.get(cap.name)
			if (existing) this.ordered = this.ordered.filter((c) => c !== existing)
		}
		this.byName.set(cap.name, cap)
		this.ordered.push(cap)
	}

	forPlatform(platform: InstallPlatform): Capability[] {
		return this.ordered.filter((c) => c.platforms.includes(platform))
	}
}

export const defaultRegistry: InstallerRegistry = new InstallerRegistry()
