# Buchhaltungs-PWA (Nadine, EÜR)

Verbindlicher Bauplan: `PLAN.md`. Phasen aus Abschnitt 10 der Reihe nach.
Änderung 23.11.2026 (Johannes): **nicht mehr nach jeder Phase anhalten** – alles durchprogrammieren, nur im Notfall fragen. Pro Phase ein Commit.

## Stand
- Phase 1 (Gerüst & Auth-Spike): gebaut, Gerätetest (iPhone/Android installiert) steht noch aus
- Phase 2–6: in Arbeit

## Stack
Vite + React + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), vite-plugin-pwa, Vitest.
Später: Dexie, jspdf + jspdf-autotable, exceljs. **Keine weiteren Laufzeit-Abhängigkeiten ohne Rückfrage.**

## Befehle
- `npm run dev` – Dev-Server auf http://localhost:5173/buchhaltung/
- `npm test` – Vitest (einmalig)
- `npm run build` – Typecheck + Build nach `dist/`
- `npm run icons` – Platzhalter-Icons nach `public/` neu erzeugen

## Feste Regeln (aus PLAN.md)
- Geld nur als Integer-Cent. Formatierung über `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`.
- Datum als `YYYY-MM-DD` lokal. **Nie `toISOString()` für Datumswerte** (UTC-Verschiebung).
- GitHub Pages: `base` kommt aus `VITE_BASE` (Default `/buchhaltung/`), im Workflow automatisch `/<repo-name>/`. Nur Hash-Routing.
- Auth liegt hinter `src/auth/auth.ts` (Schnittstelle). Implementierungen: GIS-Token-Client (Popup) und Redirect-Fallback.
- Scope ausschließlich `https://www.googleapis.com/auth/drive.file`.
- `VITE_GOOGLE_CLIENT_ID` aus `.env` (nicht committen) bzw. GitHub-Repository-Variable. Nie hart im Code.
- UI-Texte nur Deutsch, einfach, große Touch-Targets (≥ 44 px), Eingabefelder ≥ 16 px.
- Keine Analytics, keine CDN-Fonts. Einzige externe Ressource: `https://accounts.google.com/gsi/client`.
- Code-Kommentare und Commit-Messages auf Englisch.

## Struktur
- `src/auth/` – Auth-Schnittstelle + Implementierungen
- `src/drive/` – Drive-REST-Zugriff
- `src/spike/` – Phase-1-Testseite (wird in Phase 2+ durch die echte App ersetzt)
- `scripts/make-icons.mjs` – erzeugt Platzhalter-PNGs ohne Abhängigkeiten
- `.github/workflows/deploy.yml` – Push auf `main` → test → build → GitHub Pages
