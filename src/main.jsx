import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from '@/App';
import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
	<HelmetProvider>
		<App />
	</HelmetProvider>
);

// Register Service Worker for PWA
if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("/sw.js", { updateViaCache: "none" })
			.then((reg) => {
				// Si un nouveau SW est prêt, on le réactive sans attendre le prochain chargement
				if (reg.waiting) {
					reg.waiting.postMessage({ type: "SKIP_WAITING" });
				}
			})
			.catch(() => {});
	});
	let refreshing = false;
	navigator.serviceWorker.addEventListener("controllerchange", () => {
		if (refreshing) return;
		refreshing = true;
		window.location.reload();
	});
}
