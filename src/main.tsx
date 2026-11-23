import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { consumeRedirectResult } from './auth';
import { App } from './App';
import { showToast } from './ui/toast';
import './index.css';

// Must run before anything reads location.hash (hash routing).
const cameBackFromRedirect = consumeRedirectResult();

// Auto-update: the new service worker takes over and the page reloads by itself.
// A flag survives that reload so we can show a small hint afterwards.
const UPDATED_FLAG = 'app.justUpdated';
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => sessionStorage.setItem(UPDATED_FLAG, '1'));
}
registerSW({ immediate: true });
if (sessionStorage.getItem(UPDATED_FLAG)) {
  sessionStorage.removeItem(UPDATED_FLAG);
  setTimeout(() => showToast('Neue Version geladen'), 500);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App cameBackFromRedirect={cameBackFromRedirect} />
  </StrictMode>,
);
