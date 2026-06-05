#!/usr/bin/env bun
/**
 * OmniMesh docs site generator.
 * Reads `docs/src/*.md` + front-matter metadata, renders to `docs/dist/*.html`
 * using a HUD-themed layout. Vendors no JS — everything is server-rendered
 * HTML + CSS. Syntax highlighting is a small, dependency-free
 * tokenizer for the languages we actually use.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const srcDir = join(root, 'docs', 'src')
const distDir = join(root, 'docs', 'dist')
const assetsDir = join(root, 'docs', 'assets')

type FrontMatter = {
	title: string
	order?: number
	description?: string
	group?: string
}

const PAGES: { src: string; out: string; fm: FrontMatter }[] = []

function parseFrontMatter(md: string): { fm: FrontMatter; body: string } {
	if (!md.startsWith('---')) return { fm: { title: 'OmniMesh' }, body: md }
	const end = md.indexOf('\n---', 3)
	if (end < 0) return { fm: { title: 'OmniMesh' }, body: md }
	const yaml = md.slice(3, end)
	const body = md.slice(end + 4).replace(/^\r?\n/, '')
	const fm: FrontMatter = { title: 'OmniMesh' }
	for (const line of yaml.split(/\r?\n/)) {
		const m = line.match(/^([a-zA-Z][a-zA-Z0-9_]*)\s*:\s*(.*)$/)
		if (!m) continue
		const k = m[1]
		const v = (m[2] ?? '').trim()
		if (k === 'order') {
			const n = Number.parseInt(v, 10)
			if (!Number.isNaN(n)) fm.order = n
		} else if (k === 'title' || k === 'description' || k === 'group') {
			fm[k] = v.replace(/^["']|["']$/g, '')
		}
	}
	return { fm, body }
}

function mdToHtml(md: string): string {
	const lines = md.split(/\r?\n/)
	const out: string[] = []
	let inCode = false
	let codeBuf: string[] = []
	let codeLang = ''
	let inList: 'ul' | 'ol' | null = null
	let para: string[] = []

	const closePara = () => {
		if (para.length) {
			out.push(`<p>${inline(para.join(' '))}</p>`)
			para = []
		}
	}
	const closeList = () => {
		if (inList) {
			out.push(`</${inList}>`)
			inList = null
		}
	}

	const inline = (s: string) =>
		s
			.replace(/`([^`]+)`/g, '<code>$1</code>')
			.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
			.replace(/\b_([^_]+)_\b/g, '<em>$1</em>')
			.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, h) => {
				const isExternal = /^https?:/.test(h)
				const cls = isExternal ? ' class="ext"' : ''
				const tgt = isExternal ? ' target="_blank" rel="noopener"' : ''
				return `<a${cls}${tgt} href="${escapeAttr(h)}">${t}</a>`
			})

	for (let i = 0; i < lines.length; i++) {
		const raw = lines[i] ?? ''
		const line = raw

		if (line.startsWith('```')) {
			if (inCode) {
				out.push(
					`<pre class="code"><code class="lang-${escapeAttr(codeLang)}">${highlight(codeLang, codeBuf.join('\n'))}</code></pre>`,
				)
				codeBuf = []
				codeLang = ''
				inCode = false
			} else {
				closePara()
				closeList()
				inCode = true
				codeLang = line.slice(3).trim()
			}
			continue
		}
		if (inCode) {
			codeBuf.push(line)
			continue
		}

		if (line.startsWith('### ')) {
			closePara()
			closeList()
			out.push(`<h3>${inline(line.slice(4))}</h3>`)
			continue
		}
		if (line.startsWith('## ')) {
			closePara()
			closeList()
			out.push(`<h2 id="${slug(line.slice(3))}">${inline(line.slice(3))}</h2>`)
			continue
		}
		if (line.startsWith('# ')) {
			closePara()
			closeList()
			out.push(`<h1 id="${slug(line.slice(2))}">${inline(line.slice(2))}</h1>`)
			continue
		}

		const ol = line.match(/^(\d+)\.\s+(.*)$/)
		const ul = line.match(/^[-*]\s+(.*)$/)
		if (ol) {
			closePara()
			if (inList !== 'ol') {
				closeList()
				out.push('<ol>')
				inList = 'ol'
			}
			out.push(`<li>${inline(ol[2] ?? '')}</li>`)
			continue
		}
		if (ul) {
			closePara()
			if (inList !== 'ul') {
				closeList()
				out.push('<ul>')
				inList = 'ul'
			}
			out.push(`<li>${inline(ul[1] ?? '')}</li>`)
			continue
		}

		if (line.trim() === '') {
			closePara()
			closeList()
			continue
		}

		closeList()
		para.push(line)
	}
	closePara()
	closeList()
	if (inCode) {
		out.push(
			`<pre class="code"><code class="lang-${escapeAttr(codeLang)}">${highlight(codeLang, codeBuf.join('\n'))}</code></pre>`,
		)
	}
	return out.join('\n')
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)
}
function escapeAttr(s: string): string {
	return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
}
function slug(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

const KEYWORDS: Record<string, string[]> = {
	ts: [
		'import','export','from','const','let','var','function','return','if','else','for','while','await','async',
		'new','class','interface','type','enum','public','private','readonly','as','implements','extends',
		'true','false','null','undefined','void','number','string','boolean',
	],
	js: [
		'import','export','from','const','let','var','function','return','if','else','for','while','await','async',
		'new','class','true','false','null','undefined','void',
	],
	json: ['true','false','null'],
	bash: ['if','then','fi','else','elif','for','in','do','done','case','esac','export','echo','set','function'],
	yaml: ['true','false','null'],
}

function highlight(lang: string, src: string): string {
	const l = lang.toLowerCase()
	const esc = escapeHtml(src)
	if (!KEYWORDS[l]) return esc

	const kwRe = new RegExp(`\\b(${KEYWORDS[l].join('|')})\\b`, 'g')
	const strRe = /(["'`])(?:\\.|(?!\1).)*\1/g
	const numRe = /\b\d+(?:\.\d+)?\b/g
	const commRe =
		l === 'bash' ? /(#.*)$/gm : l === 'yaml' || l === 'json' ? /$^/ : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g

	let out = esc
	out = out.replace(commRe, '<span class="cmt">$1</span>')
	out = out.replace(strRe, '<span class="str">$&</span>')
	out = out.replace(numRe, '<span class="num">$&</span>')
	out = out.replace(kwRe, '<span class="kw">$1</span>')
	return out
}

function shellEscape(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}

function renderPage(body: string, fm: FrontMatter, all: PAGES, current: string): string {
	const nav = all
		.slice()
		.sort((a, b) => (a.fm.order ?? 999) - (b.fm.order ?? 999))
		.map((p) => {
			const active = p.out === current ? ' class="active"' : ''
			return `<li><a${active} href="${p.out}">${shellEscape(p.fm.title)}</a></li>`
		})
		.join('\n')

	const desc = fm.description ? `<meta name="description" content="${escapeAttr(fm.description)}">` : ''
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${shellEscape(fm.title)} — OmniMesh</title>
${desc}
<link rel="stylesheet" href="assets/styles.css">
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
</head>
<body>
<header class="topbar">
  <div class="brand">
    <span class="logo">◆</span>
    <span class="name">OmniMesh</span>
    <span class="tag">decentralized · air-gapped · sovereign</span>
  </div>
  <nav class="topnav">
    <a href="https://github.com/omnimesh/omni" class="ext">GitHub →</a>
  </nav>
</header>
<aside class="sidebar">
  <ul class="nav">${nav}</ul>
  <div class="install">
    <h4>Install</h4>
    <pre class="code"><code class="lang-bash">curl -fsSL https://omnimesh.github.io/omni/install.sh | bash</code></pre>
  </div>
</aside>
<main class="content">
  <article>${body}</article>
  <footer>
    <hr>
    <p>OmniMesh · MIT License · <a class="ext" href="https://github.com/omnimesh/omni/blob/main/SECURITY.md">security@elpraise20@gmail.com</a></p>
  </footer>
</main>
</body>
</html>
`
}

function main() {
	if (!existsSync(srcDir)) {
		console.error(`docs site source not found: ${srcDir}`)
		console.error('Create docs/src/<page>.md files first.')
		process.exit(1)
	}

	mkdirSync(distDir, { recursive: true })
	mkdirSync(join(distDir, 'assets'), { recursive: true })

	const files = readdirSync(srcDir)
		.filter((f) => f.endsWith('.md'))
		.sort()

	for (const f of files) {
		const full = join(srcDir, f)
		const raw = readFileSync(full, 'utf8')
		const { fm, body } = parseFrontMatter(raw)
		const outName = f.replace(/\.md$/, '.html')
		PAGES.push({ src: full, out: outName, fm })
	}

	for (const p of PAGES) {
		const { fm, body } = parseFrontMatter(readFileSync(p.src, 'utf8'))
		const html = renderPage(mdToHtml(body), fm, PAGES, p.out)
		writeFileSync(join(distDir, p.out), html)
		console.log(`  ${p.out}`)
	}

	copyAssets()
	console.log(`✓ docs site built → ${relative(root, distDir)} (${PAGES.length} pages)`)
}

function copyAssets() {
	const targets = ['styles.css', 'favicon.svg']
	for (const t of targets) {
		const src = join(assetsDir, t)
		if (!existsSync(src)) {
			console.warn(`  ! missing asset ${relative(root, src)} — skipping`)
			continue
		}
		const data = readFileSync(src)
		writeFileSync(join(distDir, 'assets', t), data)
	}
}

if (process.argv[1] && process.argv[1].endsWith('build.ts')) {
	main()
}
