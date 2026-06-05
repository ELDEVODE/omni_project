#!/usr/bin/env bun
/**
 * gen-capabilities.ts
 *
 * Single source of truth for the 18 QVAC capabilities OmniMesh exposes.
 * Emits a JSON matrix + a Markdown table for the docs site.
 *
 * The capability → { host, worker, mobile, openai } map is the contract
 * the README, docs site, and dashboard all rely on. Update one place,
 * run `bun run docs:gen`, and the rest follows.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

type Surface = 'host' | 'worker' | 'mobile' | 'openai'
type Row = { capability: string; host: boolean; worker: boolean; mobile: boolean; openai: boolean }

const ROWS: Row[] = [
	{ capability: 'LLM chat', host: true, worker: true, mobile: true, openai: true },
	{ capability: 'Embeddings', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'Retrieval-augmented generation', host: true, worker: true, mobile: false, openai: false },
	{ capability: 'Fine-tuning', host: true, worker: true, mobile: false, openai: false },
	{ capability: 'Multimodal', host: true, worker: true, mobile: true, openai: true },
	{ capability: 'Image generation', host: true, worker: true, mobile: false, openai: false },
	{ capability: 'Video generation', host: true, worker: true, mobile: false, openai: false },
	{ capability: 'ASR (speech → text)', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'TTS (text → speech)', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'Voice assistant (oww → asr → llm → tts)', host: false, worker: true, mobile: true, openai: false },
	{ capability: 'Translation', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'Vision-language action', host: true, worker: true, mobile: false, openai: false },
	{ capability: 'OCR', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'Image classification', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'P2P delegated inference', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'Distributed model registry', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'Model asset streaming', host: true, worker: true, mobile: true, openai: false },
	{ capability: 'Blind relays for NAT', host: true, worker: true, mobile: true, openai: false },
]

const TOTAL = ROWS.length
if (TOTAL !== 18) {
	console.error(`expected 18 capabilities, got ${TOTAL}`)
	process.exit(1)
}

const outJson = join(root, 'docs', 'data', 'capabilities.json')
const outMd = join(root, 'docs', 'data', 'capabilities.md')
mkdirSync(dirname(outJson), { recursive: true })

writeFileSync(
	outJson,
	`${JSON.stringify({ generated: new Date().toISOString(), rows: ROWS }, null, 2)}\n`,
)

const yesno = (b: boolean) => (b ? 'yes' : 'no')
const mark = (b: boolean) => (b ? '✓' : '·')
const lines: string[] = []
lines.push('| Capability | Host | Worker | Mobile | OpenAI |')
lines.push('| ---------- | :--: | :----: | :----: | :----: |')
for (const r of ROWS) {
	lines.push(`| ${r.capability} | ${mark(r.host)} | ${mark(r.worker)} | ${mark(r.mobile)} | ${mark(r.openai)} |`)
}
lines.push('')
lines.push(`*Generated from \`docs/scripts/gen-capabilities.ts\` — ${ROWS.length} capabilities.*`)

writeFileSync(outMd, lines.join('\n'))

console.log(`✓ wrote ${outJson} (${ROWS.length} rows)`)
console.log(`✓ wrote ${outMd}`)
console.log(
	`  totals: host=${ROWS.filter((r) => r.host).length} worker=${ROWS.filter((r) => r.worker).length} mobile=${ROWS.filter((r) => r.mobile).length} openai=${ROWS.filter((r) => r.openai).length}`,
)

// quick "asserted surface" output for CI gating
const expected: Record<Surface, number> = {
	host: ROWS.filter((r) => r.host).length,
	worker: ROWS.filter((r) => r.worker).length,
	mobile: ROWS.filter((r) => r.mobile).length,
	openai: ROWS.filter((r) => r.openai).length,
}
for (const [s, n] of Object.entries(expected)) {
	if (s === 'openai' && n < 1) {
		console.error(`openai surface has only ${n} caps (expected ≥ 1)`)
		process.exit(1)
	}
	// Other surfaces can have any non-zero count. Mobile is naturally smaller
	// (no fine-tuning, no RAG, no image/video gen on phones).
}
console.log(`  surface sanity ok: ${Object.entries(expected).map(([k, v]) => `${k}=${v}`).join(' ')}`)

// Also surface yes/no strings for the JSON consumer (dashboard panel)
const consumerRows = ROWS.map((r) => ({
	capability: r.capability,
	host: yesno(r.host),
	worker: yesno(r.worker),
	mobile: yesno(r.mobile),
	openai: yesno(r.openai),
}))
writeFileSync(
	join(root, 'docs', 'data', 'capabilities.consumer.json'),
	`${JSON.stringify(consumerRows, null, 2)}\n`,
)
