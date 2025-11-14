import { render } from 'preact'
import App from './App'
import './index.css'

render(<App />, document.getElementById('root'))

// Register service worker for PWA (if supported)
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js')
			.then(reg => console.log('Service worker registered.', reg))
			.catch(err => console.warn('Service worker registration failed:', err))
	})
}
