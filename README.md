# Buchhaltung (PWA)

Einfache Einnahmen-/Ausgaben-App (EÜR) für eine Kleinunternehmerin nach § 19 UStG.
Erfassen per Handy, offline-fähig, Daten im eigenen Google Drive, Monats-/Jahres-PDF und Excel-Export.

- Kein eigener Server, keine Datenbank: statische Dateien auf GitHub Pages.
- Daten liegen lokal im Browser (IndexedDB) und als `Buchhaltung-Daten.json` im Google Drive der Nutzerin.
- Google-Zugriff nur mit Scope `drive.file`: Die App sieht ausschließlich ihre eigene Datei.

Bauplan und Anforderungen: [PLAN.md](PLAN.md).

---

## Einrichtung (einmalig)

Alles läuft in deinen eigenen Konten. Zugriff auf das Google-Konto der Nutzerin ist nie nötig.

### A) GitHub (ca. 5 Min.)

1. Neues **öffentliches** Repo anlegen, z. B. `buchhaltung`. Es enthält keine Daten und keine Secrets.
   Der Repo-Name bestimmt den Pfad der App; der Workflow setzt ihn automatisch.
2. Code pushen:
   ```bash
   git remote add origin https://github.com/<user>/<repo>.git
   git push -u origin main
   ```
3. **Settings → Pages → Source: „GitHub Actions“**.
4. **Settings → Secrets and variables → Actions → Reiter „Variables“ → New repository variable**
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Wert: die Client-ID aus Schritt B
5. Danach unter **Actions** den Workflow „Deploy to GitHub Pages“ erneut starten (oder einen neuen Commit pushen).

Die App läuft dann unter `https://<user>.github.io/<repo>/`.

### B) Google Cloud Console (ca. 20 Min.)

1. Neues Projekt „Buchhaltung“ anlegen.
2. APIs & Dienste → Bibliothek → **Google Drive API** aktivieren.
3. Google Auth Platform → Branding: App-Name „Buchhaltung“, deine Mail als Support- und Entwickler-Kontakt. Nutzertyp **Extern**.
4. Datenzugriff → Scope **`https://www.googleapis.com/auth/drive.file`** hinzufügen (nicht sensibel, keine Google-Prüfung nötig).
5. Clients → **OAuth-Client-ID**, Typ **Webanwendung**:
   - **Autorisierte JavaScript-Quellen**
     - `https://<user>.github.io` (nur Host, ohne Pfad)
     - `http://localhost:5173`
   - **Autorisierte Weiterleitungs-URIs** (für den Anmelde-Fallback „Weiterleitung“)
     - `https://<user>.github.io/<repo>/` (mit Schrägstrich am Ende)
     - `http://localhost:5173/buchhaltung/`
6. Zielgruppe → Veröffentlichungsstatus **„In Produktion“**. Sonst können sich nur eingetragene Testnutzer anmelden.
7. Client-ID kopieren → in GitHub als Variable (A.4) und lokal in `.env` (siehe unten).

### C) Übergabe an die Nutzerin

- Link schicken.
  - iPhone und iPad: in **Safari** öffnen → Teilen → „Zum Home-Bildschirm“.
  - Android: in **Chrome** öffnen → „App installieren“.
- App öffnen → „Mit Google anmelden“ → Zugriff erlauben → Name eintragen. Fertig.
- Mehrere Geräte (z. B. iPhone und iPad): auf jedem Gerät installieren und mit **demselben** Google-Konto anmelden.
  Die Daten gleichen sich über Google Drive ab.
- Anmeldeweg: Auf iPhone/iPad ist **Weiterleitung** voreingestellt (Popups sind dort in installierten Web-Apps
  unzuverlässig), sonst **Fenster**. Umschalten unter Einstellungen → Google-Konto & Sicherung →
  „Probleme bei der Anmeldung?“ oder beim Fehlerhinweis im Onboarding.
- Hinweis iOS: Googles Zugriff gilt etwa eine Stunde und lässt sich per Weiterleitung nicht unbemerkt erneuern.
  Ist er abgelaufen, erscheint oben „Bitte erneut mit Google verbinden“ – ein Tipp genügt. Erfassen geht auch
  ohne Verbindung; gesichert wird danach automatisch.

**Langfristig:** Google-Cloud-Projekt und GitHub-Repo nicht löschen, sonst funktioniert die Anmeldung nicht mehr.
Die Daten in Drive bleiben in jedem Fall erhalten.

---

## Entwicklung

Voraussetzung: Node.js 24.

```bash
npm install
cp .env.example .env    # VITE_GOOGLE_CLIENT_ID eintragen
npm run dev             # http://localhost:5173/buchhaltung/
```

| Befehl | Zweck |
|---|---|
| `npm test` | Unit- und Integrationstests (Vitest) |
| `npm run build` | Typecheck + Produktions-Build nach `dist/` |
| `npm run preview` | Build lokal ansehen (inkl. Service Worker) |

Deployment: Jeder Push auf `main` führt `npm ci` → `npm test` → `npm run build` aus und veröffentlicht auf GitHub Pages.
Schlagen Tests fehl, wird nichts veröffentlicht. Die Nutzerin bekommt Updates automatisch (Hinweis „Neue Version geladen“).

### Tests

- `src/lib/lib.test.ts` – Betrags-Parsing (de-DE), Datumsfunktionen, Monats-/Jahres-/Kategoriesummen
- `src/sync/merge.test.ts` – Merge-Regel (last-write-wins, Löschungen, Reihenfolge-Unabhängigkeit)
- `src/sync/sync.test.ts` – Sync gegen einen nachgebauten Drive: erste Sicherung, zweites Gerät, Konflikt,
  neues Gerät, gelöschte Drive-Datei, offline, fehlende Anmeldung
- `src/reports/reports.test.ts` – PDF/Excel mit einem Beispieljahr; Excel-Formeln und Summen werden geprüft.
  Mit `REPORT_OUT=<ordner> npm test` werden die Beispieldateien zum Ansehen abgelegt.

### Aufbau

| Ordner | Inhalt |
|---|---|
| `src/auth/` | Anmeldung hinter einer Schnittstelle: Google-Popup (GIS) und Redirect-Fallback |
| `src/drive/` | Minimaler Drive-REST-Client |
| `src/data/` | Datenmodell, Dexie (IndexedDB), alle Schreibzugriffe (`repo.ts`) |
| `src/sync/` | Merge-Logik und Sync-Engine (Auslöser, Status, Konfliktbehandlung) |
| `src/reports/` | PDF (jspdf) und Excel (exceljs), werden erst bei Bedarf geladen |
| `src/pages/`, `src/entry/`, `src/ui/` | Oberfläche |

Wichtige Regeln: Beträge immer als Integer-Cent, Datum als lokales `YYYY-MM-DD` (nie `toISOString()` für Datumswerte),
gelöscht wird nur per `deleted: true`. Details in [CLAUDE.md](CLAUDE.md).

### Icons

Vorlage ist `icons/icon.svg` (Platzhalter `SCALE` = Größe des Motivs; 1 normal, 0,78 für das maskierbare Icon).
Die PNGs in `public/` wurden daraus gerendert. Bei Änderungen die SVG in der jeweiligen Größe (192, 512, 180 px)
als PNG exportieren, z. B. mit Inkscape oder einem Browser-Screenshot.
