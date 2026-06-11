document.addEventListener('DOMContentLoaded', () => {
	const sidebar = document.querySelector('.sidebar')
	const overlay = document.querySelector('.sidebar-overlay')
	const mobileToggle = document.querySelector('.mobile-toggle')
	const sidebarToggle = document.querySelector('.sidebar-toggle')

	/* ─── 1. OS Detection & Tab Switching ──────────── */
	const detectOS = () => {
		const ua = navigator.userAgent.toLowerCase()
		if (ua.includes('win')) return 'windows'
		if (ua.includes('mac')) return 'mac'
		if (ua.includes('linux')) return 'linux'
		return 'mac'
	}

	const os = detectOS()
	const defaultTabId = os === 'windows' ? 'tab-win' : 'tab-unix'

	const tabs = document.querySelectorAll('.os-tab')
	const contents = document.querySelectorAll('.install-content')

	const selectTab = (tabId) => {
		tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.target === tabId))
		contents.forEach(c => c.classList.toggle('active', c.id === tabId))
	}

	tabs.forEach(tab => tab.addEventListener('click', () => selectTab(tab.dataset.target)))
	if (tabs.length > 0) selectTab(defaultTabId)

	/* ─── 2. Copy buttons (sidebar install) ────────── */
	function doCopy(btn, text) {
		navigator.clipboard.writeText(text).then(() => {
			btn.classList.add('copied')
			const orig = btn.innerHTML
			btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`
			setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('copied') }, 2000)
		}).catch(() => {})
	}

	document.querySelectorAll('.copy-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const el = document.getElementById(btn.dataset.target)
			if (el) doCopy(btn, el.textContent.trim())
		})
	})

	/* ─── 3. Copy buttons on content code blocks ───── */
	document.querySelectorAll('.content pre.code').forEach(pre => {
		const btn = document.createElement('button')
		btn.className = 'code-copy-btn'
		btn.setAttribute('aria-label', 'Copy code')
		btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`
		pre.appendChild(btn)
		btn.addEventListener('click', () => {
			const code = pre.querySelector('code')
			if (!code) return
			navigator.clipboard.writeText(code.textContent.trim()).then(() => {
				btn.classList.add('copied')
				btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`
				setTimeout(() => {
					btn.classList.remove('copied')
					btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`
				}, 2000)
			}).catch(() => {})
		})
	})

	/* ─── 4. Mobile sidebar toggle ────────────────── */
	function closeMobile() {
		if (sidebar) sidebar.classList.remove('open')
		if (overlay) overlay.classList.remove('active')
	}

	if (mobileToggle && sidebar) {
		mobileToggle.addEventListener('click', () => {
			sidebar.classList.toggle('open')
			if (overlay) overlay.classList.toggle('active')
		})
	}
	if (overlay) overlay.addEventListener('click', closeMobile)

	document.querySelectorAll('.sidebar .nav a').forEach(link => {
		link.addEventListener('click', () => {
			if (window.innerWidth <= 860) closeMobile()
		})
	})

	/* ─── 5. Desktop sidebar collapse ─────────────── */
	if (sidebarToggle) {
		const key = 'omni-sidebar-collapsed'
		if (localStorage.getItem(key) === '1') document.body.classList.add('sidebar-collapsed')

		sidebarToggle.addEventListener('click', () => {
			document.body.classList.toggle('sidebar-collapsed')
			localStorage.setItem(key, document.body.classList.contains('sidebar-collapsed') ? '1' : '0')
		})
	}

	/* ─── 6. Search Modal Controller ──────────────── */
	const searchTrigger = document.querySelector('.search-trigger')
	const searchModal = document.getElementById('searchModal')
	const searchInput = document.getElementById('searchModalInput')
	const searchResults = document.querySelector('.search-modal-results')
	const closeBtn = document.querySelector('.search-modal-close')
	let searchIndex = null
	let activeIndex = -1
	let resultItems = []

	// Load search index lazily
	async function loadSearchIndex() {
		if (searchIndex) return
		try {
			const res = await fetch('assets/search-index.json')
			searchIndex = await res.json()
			// Pre-compute lowercase body + title + trigrams for each entry
			for (const entry of searchIndex) {
				entry._title = entry.title.toLowerCase()
				entry._body = entry.body.toLowerCase()
				entry._all = entry._title + ' ' + entry._body
			}
		} catch (e) {
			console.warn('Search index not available', e)
			searchIndex = []
		}
	}

	function openModal() {
		loadSearchIndex().then(() => {
			document.body.classList.add('search-modal-open')
			searchModal.setAttribute('aria-hidden', 'false')
			setTimeout(() => {
				if (searchInput) searchInput.focus()
			}, 50)
		})
	}

	function closeModal() {
		document.body.classList.remove('search-modal-open')
		searchModal.setAttribute('aria-hidden', 'true')
		if (searchInput) {
			searchInput.value = ''
			searchInput.blur()
		}
		if (searchResults) {
			searchResults.innerHTML = ''
		}
		activeIndex = -1
		resultItems = []
	}

	// Trigger button click
	if (searchTrigger) {
		searchTrigger.addEventListener('click', openModal)
	}

	// Close button click
	if (closeBtn) {
		closeBtn.addEventListener('click', closeModal)
	}

	// Backdrop click close
	if (searchModal) {
		searchModal.addEventListener('click', (e) => {
			if (e.target === searchModal) {
				closeModal()
			}
		})
	}

	/**
	 * Scoring algorithm:
	 *  - Exact phrase match in title:  100 pts
	 *  - Word match in title:           20 pts per word
	 *  - Exact phrase match in body:    15 pts
	 *  - Word match in body:             3 pts per word
	 *  - Position bonus: earlier = higher (small)
	 */
	function searchDocs(query) {
		if (!searchIndex || !query) return []
		const q = query.toLowerCase().trim()
		if (q.length < 2) return []

		const words = q.split(/\s+/).filter(w => w.length >= 2)
		const results = []

		for (const entry of searchIndex) {
			let score = 0
			let matchPos = -1

			// Exact phrase in title
			const titleIdx = entry._title.indexOf(q)
			if (titleIdx >= 0) {
				score += 100
				matchPos = 0
			}

			// Exact phrase in body
			const bodyIdx = entry._body.indexOf(q)
			if (bodyIdx >= 0) {
				score += 15
				if (matchPos < 0) matchPos = bodyIdx
			}

			// Individual word matches
			for (const w of words) {
				if (entry._title.includes(w)) score += 20
				if (entry._body.includes(w)) {
					score += 3
					if (matchPos < 0) matchPos = entry._body.indexOf(w)
				}
			}

			// Position bonus (earlier matches score slightly higher)
			if (matchPos >= 0) {
				score += Math.max(0, 5 - Math.floor(matchPos / 200))
			}

			if (score > 0) {
				results.push({ entry, score, matchPos: matchPos >= 0 ? matchPos : 0 })
			}
		}

		// Sort by score descending, then by title
		results.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
		return results.slice(0, 8)
	}

	function getSnippet(body, query, maxLen) {
		maxLen = maxLen || 120
		const q = query.toLowerCase().trim()
		const lower = body.toLowerCase()
		let idx = lower.indexOf(q)
		if (idx < 0) {
			const words = q.split(/\s+/)
			for (const w of words) {
				idx = lower.indexOf(w)
				if (idx >= 0) break
			}
		}
		if (idx < 0) return body.slice(0, maxLen) + (body.length > maxLen ? '...' : '')

		const start = Math.max(0, idx - 40)
		const end = Math.min(body.length, idx + maxLen - 40)
		let snippet = (start > 0 ? '...' : '') + body.slice(start, end) + (end < body.length ? '...' : '')
		return snippet
	}

	function highlightText(text, query) {
		if (!query) return text
		const q = query.trim()
		if (q.length < 2) return text
		const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		const re = new RegExp('(' + escaped + ')', 'gi')
		return text.replace(re, '<mark>$1</mark>')
	}

	let searchTimeout = null

	function onSearchInput() {
		const q = searchInput.value
		if (searchTimeout) clearTimeout(searchTimeout)
		searchTimeout = setTimeout(() => {
			if (!searchResults) return
			if (!q || q.trim().length < 2) {
				searchResults.innerHTML = ''
				activeIndex = -1
				resultItems = []
				return
			}
			const hits = searchDocs(q)
			if (hits.length === 0) {
				searchResults.innerHTML = `<div class="search-modal-empty">No results for "${q}"</div>`
				activeIndex = -1
				resultItems = []
				return
			}
			searchResults.innerHTML = hits.map(h => {
				const snippet = getSnippet(h.entry.body, q)
				return `<li><a href="${h.entry.url}">
					<span class="search-title">${highlightText(h.entry.title, q)}</span>
					<span class="search-snippet">${highlightText(snippet, q)}</span>
				</a></li>`
			}).join('')
			
			resultItems = Array.from(searchResults.querySelectorAll('li'))
			activeIndex = 0
			updateActiveResult()
		}, 120) // debounce 120ms
	}

	function updateActiveResult() {
		if (!resultItems.length) return
		resultItems.forEach((li, idx) => {
			li.classList.toggle('active', idx === activeIndex)
		})
		const activeItem = resultItems[activeIndex]
		if (activeItem) {
			activeItem.scrollIntoView({ block: 'nearest' })
		}
	}

	if (searchInput) {
		searchInput.addEventListener('input', onSearchInput)
	}

	// Keyboard event listener for shortcuts & navigation
	document.addEventListener('keydown', (e) => {
		const isModalOpen = document.body.classList.contains('search-modal-open')

		// / shortcut to open modal
		if (e.key === '/' && !isModalOpen) {
			const tag = document.activeElement?.tagName
			if (tag === 'INPUT' || tag === 'TEXTAREA') return
			e.preventDefault()
			openModal()
		}

		if (isModalOpen) {
			if (e.key === 'Escape') {
				e.preventDefault()
				closeModal()
			} else if (e.key === 'ArrowDown') {
				e.preventDefault()
				if (resultItems.length) {
					activeIndex = (activeIndex + 1) % resultItems.length
					updateActiveResult()
				}
			} else if (e.key === 'ArrowUp') {
				e.preventDefault()
				if (resultItems.length) {
					activeIndex = (activeIndex - 1 + resultItems.length) % resultItems.length
					updateActiveResult()
				}
			} else if (e.key === 'Enter') {
				if (resultItems.length && activeIndex >= 0) {
					const activeLink = resultItems[activeIndex].querySelector('a')
					if (activeLink) {
						e.preventDefault()
						activeLink.click()
						closeModal()
					}
				}
			}
		}
	})
})
