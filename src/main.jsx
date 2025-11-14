import { render } from 'preact'
import App from './App'
import './index.css'

render(<App />, document.getElementById('root'))

// Register service worker for PWA (if supported)
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
			// Determine a base path for the app so service worker registration works
			// for GitHub Pages repo pages (served on a subpath) and local preview.
			const baseFromVite = import.meta.env && import.meta.env.BASE_URL ? import.meta.env.BASE_URL : null
			const fallbackBase = (function () {
				// Use the current path directory as a fallback (e.g. /<repo>/)
				let p = window.location.pathname
				if (p.endsWith('/')) return p
				return p.substring(0, p.lastIndexOf('/') + 1) || '/'
			})()
			const base = baseFromVite || fallbackBase
			const swPath = base + 'sw.js'
		navigator.serviceWorker.register(swPath)
			.then(reg => {
				console.log('Service worker registered at', swPath, reg)
				return navigator.serviceWorker.ready
			})
			.then(() => {
				console.log('Service worker active and ready')
			})
			.catch(err => console.warn('Service worker registration failed:', err))
	})
}
