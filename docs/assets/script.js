document.addEventListener('DOMContentLoaded', () => {
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
		tabs.forEach(tab => {
			tab.classList.toggle('active', tab.dataset.target === tabId)
		})
		contents.forEach(content => {
			content.classList.toggle('active', content.id === tabId)
		})
	}

	tabs.forEach(tab => {
		tab.addEventListener('click', () => selectTab(tab.dataset.target))
	})

	if (tabs.length > 0) {
		selectTab(defaultTabId)
	}

	/* ─── 2. Copy-to-clipboard (sidebar) ──────────── */
	function handleCopy(btn, text) {
		navigator.clipboard.writeText(text).then(() => {
			btn.classList.add('copied')
			const orig = btn.innerHTML
			btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
			setTimeout(() => {
				btn.innerHTML = orig
				btn.classList.remove('copied')
			}, 2000)
		}).catch(() => {})
	}

	document.querySelectorAll('.copy-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const codeEl = document.getElementById(btn.dataset.target)
			if (codeEl) handleCopy(btn, codeEl.textContent.trim())
		})
	})

	/* ─── 3. Copy buttons on all content code blocks ─ */
	document.querySelectorAll('.content pre.code').forEach(pre => {
		const btn = document.createElement('button')
		btn.className = 'code-copy-btn'
		btn.setAttribute('aria-label', 'Copy code')
		btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`
		pre.appendChild(btn)
		btn.addEventListener('click', () => {
			const code = pre.querySelector('code')
			if (code) {
				navigator.clipboard.writeText(code.textContent.trim()).then(() => {
					btn.classList.add('copied')
					btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`
					setTimeout(() => {
						btn.classList.remove('copied')
						btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`
					}, 2000)
				}).catch(() => {})
			}
		})
	})

	/* ─── 4. Mobile sidebar toggle ────────────────── */
	const toggle = document.querySelector('.mobile-toggle')
	const sidebar = document.querySelector('.sidebar')
	const overlay = document.querySelector('.sidebar-overlay')

	if (toggle && sidebar) {
		toggle.addEventListener('click', () => {
			sidebar.classList.toggle('open')
			if (overlay) overlay.classList.toggle('active')
		})
	}
	if (overlay) {
		overlay.addEventListener('click', () => {
			sidebar.classList.remove('open')
			overlay.classList.remove('active')
		})
	}

	// Close sidebar when clicking a nav link on mobile
	document.querySelectorAll('.sidebar .nav a').forEach(link => {
		link.addEventListener('click', () => {
			if (window.innerWidth <= 860) {
				sidebar.classList.remove('open')
				if (overlay) overlay.classList.remove('active')
			}
		})
	})
})
