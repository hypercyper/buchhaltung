import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

// GitHub Pages serves the app under /<repo>/. The workflow sets VITE_BASE from the repo name.
const DEFAULT_BASE = '/buchhaltung/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const base = env.VITE_BASE || DEFAULT_BASE;

  return {
    base,
    // exceljs/jspdf are lazy-loaded report chunks; their size does not affect app start.
    build: { chunkSizeWarningLimit: 1000 },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Buchhaltung',
          short_name: 'Buchhaltung',
          description: 'Einnahmen und Ausgaben einfach erfassen',
          lang: 'de',
          start_url: base,
          scope: base,
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#0f766e',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
          navigateFallback: `${base}index.html`,
        },
      }),
    ],
    test: {
      environment: 'node',
    },
  };
});
