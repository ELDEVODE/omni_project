import { c } from './ui/banner.ts'

export type CommandContext = {
	args: string[]
	flags: Record<string, string | boolean>
}

export type Command = {
	name: string
	description: string
	usage: string
	run: (ctx: CommandContext) => Promise<number> | number
}

function parseArgs(argv: string[]): {
	cmd: string | null
	rest: string[]
	flags: Record<string, string | boolean>
} {
	const [cmd, ...rest] = argv
	const flags: Record<string, string | boolean> = {}
	const positional: string[] = []
	for (let i = 0; i < rest.length; i++) {
		const a = rest[i]
		if (a === undefined) continue
		if (a.startsWith('--')) {
			const eq = a.indexOf('=')
			if (eq > -1) {
				flags[a.slice(2, eq)] = a.slice(eq + 1)
			} else {
				const key = a.slice(2)
				const next = rest[i + 1]
				if (next !== undefined && !next.startsWith('--')) {
					flags[key] = next
					i++
				} else {
					flags[key] = true
				}
			}
		} else {
			positional.push(a)
		}
	}
	return { cmd: cmd ?? null, rest: positional, flags }
}

function help(commands: Command[]): string {
	const lines = [
		`${c.cyan}${c.bold}omni${c.reset} — OmniMesh CLI`,
		'',
		`${c.dim}Usage:${c.reset} omni <command> [args] [flags]`,
		'',
		`${c.bold}Commands:${c.reset}`,
	]
	for (const cmd of commands) {
		lines.push(`  ${c.cyan}${cmd.name.padEnd(14)}${c.reset} ${cmd.description}`)
	}
	lines.push('')
	lines.push(
		`${c.dim}Run ${c.reset}omni <command> --help${c.dim} for command-specific usage.${c.reset}`,
	)
	return lines.join('\n')
}

export async function runCli(
	commands: Command[],
	argv: string[],
): Promise<number> {
	const { cmd, rest, flags } = parseArgs(argv)
	if (!cmd || cmd === 'help') {
		// eslint-disable-next-line no-console
		console.log(help(commands))
		return 0
	}
	const command = commands.find((c) => c.name === cmd)
	if (!command) {
		// eslint-disable-next-line no-console
		console.error(`${c.red}✗${c.reset} unknown command: ${cmd}`)
		// eslint-disable-next-line no-console
		console.log(help(commands))
		return 1
	}
	if (flags.help) {
		// eslint-disable-next-line no-console
		console.log(
			`${c.cyan}${command.name}${c.reset} — ${command.description}\n\n${c.dim}Usage:${c.reset} omni ${command.usage}`,
		)
		return 0
	}
	try {
		return await command.run({ args: rest, flags })
	} catch (err) {
		// eslint-disable-next-line no-console
		console.error(`${c.red}✗${c.reset} ${(err as Error).message}`)
		return 1
	}
}
