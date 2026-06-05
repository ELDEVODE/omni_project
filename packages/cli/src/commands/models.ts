import type { Command, CommandContext } from '../router.ts'
import { c } from '../ui/banner.ts'

async function listModels(ctx: CommandContext): Promise<number> {
	const provider =
		(ctx.flags.provider as string) ?? process.env.OMNI_PROVIDER_PUBLIC_KEY
	const secret = (ctx.flags.secret as string) ?? process.env.OMNI_SECRET
	const baseUrl = 'http://127.0.0.1:11434/v1/models'
	const url = new URL(baseUrl)
	if (secret) url.searchParams.set('token', secret)

	try {
		const res = await fetch(url.toString(), {
			headers: provider ? { 'X-Provider-Public-Key': provider } : {},
		})
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
		const data = (await res.json()) as { data?: Array<{ id: string }> }
		console.log(`${c.cyan}Loaded models:${c.reset}`)
		for (const m of data.data ?? []) {
			console.log(`  ${c.green}${m.id}${c.reset}`)
		}
		return 0
	} catch (err) {
		console.error(`${c.red}✗${c.reset} ${(err as Error).message}`)
		return 1
	}
}

async function pullModel(ctx: CommandContext): Promise<number> {
	const alias = ctx.args[0]
	if (!alias) {
		console.error(
			`${c.red}✗${c.reset} alias required: omni models pull <alias>`,
		)
		return 1
	}
	console.log(
		`${c.yellow}⚠${c.reset} Model pull not yet implemented — edit qvac.config.json serve.models and restart host`,
	)
	return 0
}

async function runModel(ctx: CommandContext): Promise<number> {
	const alias = ctx.args[0]
	const prompt = (ctx.flags.prompt as string) ?? (ctx.flags.p as string)
	if (!alias || !prompt) {
		console.error(`${c.red}✗${c.reset} alias and --prompt required`)
		return 1
	}
	const secret = (ctx.flags.secret as string) ?? process.env.OMNI_SECRET
	const res = await fetch('http://127.0.0.1:11434/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(secret ? { Authorization: `Bearer ${secret}` } : {}),
		},
		body: JSON.stringify({
			model: alias,
			messages: [{ role: 'user', content: prompt }],
			stream: true,
		}),
	})
	if (!res.ok) {
		console.error(`${c.red}✗${c.reset} ${res.status} ${await res.text()}`)
		return 1
	}
	for await (const chunk of res.body ?? []) {
		const text = new TextDecoder().decode(chunk)
		for (const line of text.split('\n')) {
			if (line.startsWith('data: ') && line !== 'data: [DONE]') {
				try {
					const data = JSON.parse(line.slice(6))
					const delta = data.choices?.[0]?.delta?.content
					if (delta) process.stdout.write(delta)
				} catch {}
			}
		}
	}
	console.log()
	return 0
}

async function deleteModel(ctx: CommandContext): Promise<number> {
	const alias = ctx.args[0]
	if (!alias) {
		console.error(
			`${c.red}✗${c.reset} alias required: omni models delete <alias>`,
		)
		return 1
	}
	const secret = (ctx.flags.secret as string) ?? process.env.OMNI_SECRET
	const res = await fetch(`http://127.0.0.1:11434/v1/models/${alias}`, {
		method: 'DELETE',
		headers: secret ? { Authorization: `Bearer ${secret}` } : {},
	})
	if (res.ok) {
		console.log(`${c.green}✓${c.reset} Model ${alias} unloaded`)
		return 0
	}
	console.error(`${c.red}✗${c.reset} ${res.status} ${await res.text()}`)
	return 1
}

export const modelsCommand: Command = {
	name: 'models',
	description:
		'Manage QVAC models via the model registry and OpenAI-compat server.',
	usage:
		'models <list|pull|run|delete> [alias] [--provider=<pubkey>] [--secret=abc123] [--prompt="..."]',
	run: async (ctx: CommandContext) => {
		const sub = ctx.args[0]
		if (!sub) {
			console.error(
				`${c.red}✗${c.reset} subcommand required: list|pull|run|delete`,
			)
			return 1
		}
		switch (sub) {
			case 'list':
				return listModels(ctx)
			case 'pull':
				return pullModel(ctx)
			case 'run':
				return runModel(ctx)
			case 'delete':
				return deleteModel(ctx)
			default:
				console.error(`${c.red}✗${c.reset} unknown subcommand: ${sub}`)
				return 1
		}
	},
}
