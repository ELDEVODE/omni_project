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
				const lang = codeLang || 'text'
				out.push(
					`<pre class="code" data-lang="${escapeAttr(lang)}"><code class="lang-${escapeAttr(lang)}">${highlight(codeLang, codeBuf.join('\n'))}</code></pre>`,
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
		const lang = codeLang || 'text'
		out.push(
			`<pre class="code" data-lang="${escapeAttr(lang)}"><code class="lang-${escapeAttr(lang)}">${highlight(codeLang, codeBuf.join('\n'))}</code></pre>`,
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

function buildGroupedNav(all: PAGES, current: string): string {
	const sorted = all.slice().sort((a, b) => (a.fm.order ?? 999) - (b.fm.order ?? 999))
	const groups = new Map<string, typeof sorted>()
	for (const p of sorted) {
		const g = p.fm.group || 'Docs'
		if (!groups.has(g)) groups.set(g, [])
		groups.get(g)!.push(p)
	}
	const parts: string[] = []
	for (const [group, pages] of groups) {
		parts.push(`<div class="nav-group">`)
		parts.push(`<span class="nav-group-label">${shellEscape(group)}</span>`)
		parts.push(`<ul class="nav">`)
		for (const p of pages) {
			const active = p.out === current ? ' class="active"' : ''
			parts.push(`<li><a${active} href="${p.out}">${shellEscape(p.fm.title)}</a></li>`)
		}
		parts.push(`</ul></div>`)
	}
	return parts.join('\n')
}

function buildToc(body: string): string {
	const re = /<h2 id="([^"]+)">(.*?)<\/h2>/g
	const items: string[] = []
	let m: RegExpExecArray | null
	while ((m = re.exec(body)) !== null) {
		const id = m[1]
		const text = (m[2] ?? '').replace(/<[^>]+>/g, '')
		items.push(`<li><a href="#${id}">${text}</a></li>`)
	}
	if (items.length < 2) return ''
	return `<nav class="page-toc">
<div class="page-toc-title">On this page</div>
<ul>${items.join('\n')}</ul>
</nav>`
}

function renderPage(body: string, fm: FrontMatter, all: PAGES, current: string): string {
	const nav = buildGroupedNav(all, current)

	const desc = fm.description ? `<meta name="description" content="${escapeAttr(fm.description)}">` : ''
	const isHome = current === 'index.html'
	const hero = isHome
		? `<div class="hero">
<h1>${shellEscape(fm.title)}<span class="version-badge">v0.1.0</span></h1>
<p>${fm.description ? shellEscape(fm.description) : 'Decentralized, air-gappable AI mesh.'}</p>
<a class="cta" href="quickstart.html">Get Started →</a>
</div>`
		: ''
	const toc = !isHome ? buildToc(body) : ''
	const bodyContent = isHome
		? hero + body.replace(/<h1[^>]*>.*?<\/h1>/, '')
		: toc + body
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${shellEscape(fm.title)} — OmniMesh</title>
${desc}
<link rel="stylesheet" href="assets/styles.css">
<link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
<script src="assets/script.js" defer></script>
</head>
<body>
<header class="topbar">
  <button class="mobile-toggle" aria-label="Toggle navigation">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>
  <button class="sidebar-toggle" aria-label="Toggle sidebar">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
  </button>
  <div class="brand">
    <span class="logo"><svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#ff3366" rx="3" stroke="#000" stroke-width="2"/>
      <polygon points="16,5 27,16 16,27 5,16" fill="#000"/>
      <polygon points="16,9 23,16 16,23 9,16" fill="#fff"/>
      <rect x="13" y="14" width="6" height="4" fill="#ff3366" rx="1"/>
    </svg></span>
    <span class="name">OmniMesh</span>
    <span class="tag">decentralized · air-gapped · sovereign</span>
  </div>
  <nav class="topnav">
    <a href="https://github.com/ELDEVODE/omni_project">GitHub</a>
  </nav>
</header>
<div class="sidebar-overlay"></div>
<aside class="sidebar">
  <div class="search-wrapper">
    <button class="search-trigger" aria-label="Search documentation" type="button">
      <svg class="search-trigger-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <span class="search-trigger-placeholder">Search docs...</span>
      <kbd class="search-trigger-kbd">/</kbd>
    </button>
  </div>
  ${nav}
  <div class="install-box">
    <div class="install-header">
      <span class="label">⚡ quick install</span>
      <div class="os-tabs">
        <button class="os-tab" data-target="tab-unix">macOS / Linux</button>
        <button class="os-tab" data-target="tab-win">Windows</button>
      </div>
    </div>
    <div id="tab-unix" class="install-content">
      <pre class="code"><code id="code-unix" class="lang-bash">curl -fsSL https://omnimesh.github.io/omni/install.sh | bash</code></pre>
      <button class="copy-btn" data-target="code-unix" aria-label="Copy command">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy
      </button>
    </div>
    <div id="tab-win" class="install-content">
      <pre class="code"><code id="code-win" class="lang-powershell">iwr -useb https://omnimesh.github.io/omni/install.ps1 | iex</code></pre>
      <button class="copy-btn" data-target="code-win" aria-label="Copy command">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy
      </button>
    </div>
  </div>
</aside>
<main class="content">
  <article>${bodyContent}</article>
  <footer>
    <hr>
    <p>OmniMesh · MIT License · <a class="ext" href="https://github.com/ELDEVODE/omni_project">GitHub</a> · <a href="mailto:elpraise20@gmail.com">contact</a></p>
  </footer>
</main>
<!-- Search Modal -->
<div class="search-modal-backdrop" id="searchModal" aria-hidden="true" role="dialog">
  <div class="search-modal">
    <header class="search-modal-header">
      <svg class="search-modal-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input type="text" class="search-modal-input" id="searchModalInput" placeholder="Search documentation..." aria-label="Search documentation" autocomplete="off" spellcheck="false">
      <button class="search-modal-close" aria-label="Close search" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </header>
    <div class="search-modal-body">
      <ul class="search-modal-results"></ul>
    </div>
    <footer class="search-modal-footer">
      <div class="search-modal-hints">
        <span class="hint-item"><kbd>↑↓</kbd> to navigate</span>
        <span class="hint-item"><kbd>↵</kbd> to select</span>
        <span class="hint-item"><kbd>ESC</kbd> to close</span>
      </div>
    </footer>
  </div>
</div>
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

function stripMarkdown(md: string): string {
	return md
		.replace(/```[\s\S]*?```/g, '')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/\*\*([^*]+)\*\*/g, '$1')
		.replace(/__([^_]+)__/g, '$1')
		.replace(/\*([^*]+)\*/g, '$1')
		.replace(/_([^_]+)_/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim()
}

function copyAssets() {
	const targets = ['styles.css', 'favicon.svg', 'script.js']
	for (const t of targets) {
		const src = join(assetsDir, t)
		if (!existsSync(src)) {
			console.warn(`  ! missing asset ${relative(root, src)} — skipping`)
			continue
		}
		const data = readFileSync(src)
		writeFileSync(join(distDir, 'assets', t), data)
	}

	const installScripts = [
		{ src: join(root, 'docs', 'install.sh'), out: 'install.sh' },
		{ src: join(root, 'docs', 'install.ps1'), out: 'install.ps1' },
	]
	for (const { src, out } of installScripts) {
		if (!existsSync(src)) {
			console.warn(`  ! missing install script ${relative(root, src)} — skipping`)
			continue
		}
		const data = readFileSync(src)
		writeFileSync(join(distDir, out), data)
		console.log(`  ${out}`)
	}

	// Generate search index
	const searchIndex: { title: string; url: string; body: string; group: string }[] = []
	for (const p of PAGES) {
		const raw = readFileSync(p.src, 'utf8')
		const { fm, body } = parseFrontMatter(raw)
		const plainBody = stripMarkdown(body).slice(0, 2000)
		searchIndex.push({
			title: fm.title,
			url: p.out,
			body: plainBody,
			group: fm.group || 'Docs',
		})
	}
	writeFileSync(join(distDir, 'assets', 'search-index.json'), JSON.stringify(searchIndex))
	console.log('  search-index.json')
}

if (process.argv[1] && process.argv[1].endsWith('build.ts')) {
	main()
}
