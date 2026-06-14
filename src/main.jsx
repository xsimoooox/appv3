import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { getWakwakUser } from './lib/wakwakUser'
import { initSocket } from './lib/socket'

// Enregistrement du Service Worker pour le support PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
        console.log('Service Worker enregistré avec succès ! Portée :', reg.scope);
      })
      .catch((err) => {
        console.error('Échec de l\'enregistrement du Service Worker :', err);
      });
  });
}

if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
  window.addEventListener('load', () => {
    Notification.requestPermission().catch(() => {});
  });
}

function initAppOnLoad() {
  const user = getWakwakUser();
  if (user?.id) {
    initSocket(user);
  }
}

initAppOnLoad();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
