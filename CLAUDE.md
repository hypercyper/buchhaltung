# Buchhaltungs-PWA (Nadine, EÜR)

Verbindlicher Bauplan: `PLAN.md`. Phasen aus Abschnitt 10 der Reihe nach.
Änderung 23.11.2026 (Johannes): **nicht mehr nach jeder Phase anhalten** – alles durchprogrammieren, nur im Notfall fragen. Pro Phase ein Commit.

## Stand
- Phase 1–6 gebaut (23.11.2026). Offen, braucht Johannes: GitHub-Repo + Google-OAuth-Client anlegen,
  dann Gerätetest (Login in installierter App auf iPhone und Android, zwei Geräte synchron).

## Stack
Vite + React + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), vite-plugin-pwa, Dexie, jspdf + jspdf-autotable,
exceljs. Dev: Vitest, fake-indexeddb. **Keine weiteren Laufzeit-Abhängigkeiten ohne Rückfrage.**

## Befehle
- `npm run dev` – Dev-Server auf http://localhost:5173/buchhaltung/
- `npm test` – Vitest (einmalig); `REPORT_OUT=<dir>` legt Beispiel-PDF/-Excel ab
- `npm run build` – Typecheck (ohne `*.test.ts`) + Build nach `dist/`

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

- Teilen-Dialog (`navigator.share`) nur auf Touch-Geräten, sonst Download. iOS braucht für `share` einen frischen Tipp →
  `NeedsTapError` → zweiter Button „jetzt teilen“.
- Startkategorien haben feste IDs (`start-<typ>-<n>`) und `updatedAt` = Epoch, damit zwei Geräte keine Duplikate erzeugen.
- Sync-Konflikt wird über die Drive-`version` erkannt (vor dem Upload neu prüfen, sonst Runde wiederholen).

## Struktur
Siehe README „Aufbau“. Kurz: `auth/`, `drive/`, `data/` (repo.ts = alle Schreibzugriffe), `sync/`, `reports/`,
`pages/`, `entry/`, `ui/`. Icon-Vorlage `icons/icon.svg`.
`.github/workflows/deploy.yml` – Push auf `main` → test → build → GitHub Pages.

## Lokales Testen ohne Google
Onboarding verlangt Google-Login. Für UI-Tests im Browser in IndexedDB `buchhaltung`, Store `kv`,
`{ key: 'app.onboarded', value: true }` setzen und neu laden. Service Worker cacht den Build: nach `npm run build`
einmal extra neu laden.
