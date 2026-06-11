document.addEventListener('DOMContentLoaded', () => {
	// 1. OS Detection & Tab Switching
	const detectOS = () => {
		const ua = navigator.userAgent.toLowerCase()
		if (ua.includes('win')) return 'windows'
		if (ua.includes('mac')) return 'mac'
		if (ua.includes('linux')) return 'linux'
		return 'mac' // fallback
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

	// 2. Copy functionality
	const copyBtns = document.querySelectorAll('.copy-btn')
	copyBtns.forEach(btn => {
		btn.addEventListener('click', () => {
			const targetId = btn.dataset.target
			const codeBlock = document.getElementById(targetId)
			if (!codeBlock) return
			
			const text = codeBlock.textContent.trim()
			navigator.clipboard.writeText(text).then(() => {
				const originalText = btn.innerHTML
				btn.innerHTML = `
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: middle;">
						<polyline points="20 6 9 17 4 12"></polyline>
					</svg> Copied!
				`
				btn.classList.add('copied')
				setTimeout(() => {
					btn.innerHTML = originalText
					btn.classList.remove('copied')
				}, 2000)
			}).catch(err => console.error('Failed to copy', err))
		})
	})
})
