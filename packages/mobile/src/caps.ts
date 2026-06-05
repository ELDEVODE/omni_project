// Detect the phone's capabilities and report them in the mesh HELLO envelope.
// Uses expo-device for hardware facts; runtime hints come from env / config.

import type { CapsReport, OSType } from '@omnimesh/protocol'
import * as Device from 'expo-device'

export type DetectOpts = {
	alwaysOnVoice?: boolean
	hostname?: string
	ip?: string
}

export function detectCaps(name: string, opts: DetectOpts = {}): CapsReport {
	const ram = Device.totalMemory
		? Math.round(Device.totalMemory / 1024 ** 3)
		: 4
	const os = (Device.osName?.toLowerCase() ?? 'unknown') as OSType
	const isIos = os === 'ios' || os === 'darwin'
	return {
		os,
		arch: 'arm64',
		cpu: {
			cores: Device.supportedCpuArchitectures?.[0] === 'arm64' ? 8 : 4,
			model: Device.modelName ?? 'mobile',
		},
		ram: { totalGb: ram, freeGb: Math.max(1, Math.floor(ram / 2)) },
		gpu: isIos
			? { api: 'metal', name: 'Apple GPU' }
			: { api: 'vulkan', name: 'Mobile GPU' },
		disk: { freeGb: 32 },
		runtimes: ['qvac'],
		network: {
			ip: opts.ip ?? '0.0.0.0',
			hostname: opts.hostname ?? name,
		},
		alwaysOnVoice: Boolean(opts.alwaysOnVoice),
		protocolVersion: 1,
	}
}
