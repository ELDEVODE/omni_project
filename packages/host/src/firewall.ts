import { spawnSync } from 'node:child_process'
import { log } from './log.ts'

export function ensureWindowsFirewall(): void {
	if (process.platform !== 'win32') return

	try {
		// Use PowerShell to check if our specific rule exists
		const checkCmd = spawnSync(
			'powershell',
			[
				'-NoProfile',
				'-Command',
				'Get-NetFirewallRule -DisplayName "OmniMesh P2P (Node.js)" -ErrorAction SilentlyContinue',
			],
			{ encoding: 'utf8' },
		)

		if (checkCmd.stdout?.includes('OmniMesh P2P (Node.js)')) {
			// Rule already exists, we are good
			return
		}

		log.warn(
			'Windows Firewall is blocking P2P. Prompting for Admin access to automatically fix this...',
		)

		// Locate the node executable that the bridge uses
		const whereNode = spawnSync('where.exe', ['node'], { encoding: 'utf8' })
		const nodePath = whereNode.stdout.split(/\r?\n/)[0]?.trim()

		if (!nodePath) {
			log.warn(
				'Could not locate node.exe to add firewall rule. Please add it manually.',
			)
			return
		}

		const script = `New-NetFirewallRule -DisplayName "OmniMesh P2P (Node.js)" -Direction Inbound -Program "${nodePath}" -Action Allow -Profile Any -Protocol UDP; New-NetFirewallRule -DisplayName "OmniMesh P2P (Node.js)" -Direction Outbound -Program "${nodePath}" -Action Allow -Profile Any -Protocol UDP;`

		// Trigger UAC prompt using Start-Process -Verb RunAs
		const result = spawnSync('powershell', [
			'-NoProfile',
			'-WindowStyle',
			'Hidden',
			'-Command',
			`Start-Process powershell -ArgumentList '-NoProfile -WindowStyle Hidden -Command "${script}"' -Verb RunAs -Wait`,
		])

		if (result.status === 0) {
			log.info('Windows Firewall configured successfully.')
		} else {
			log.warn('Windows Firewall configuration was cancelled or failed.')
		}
	} catch (err) {
		log.warn(`Failed to configure Windows Firewall: ${(err as Error).message}`)
	}
}
