# Bauplan: Buchhaltungs-PWA (Einnahmen/Ausgaben, EÜR) für eine Kleinunternehmerin

> Dieser Plan ist für Claude Code geschrieben. Arbeite die Phasen der Reihe nach ab. Nach jeder Phase hältst du an, fasst zusammen, was gebaut wurde, und wartest auf Freigabe.

## 1. Ziel und Rahmen

Eine sehr einfache PWA, mit der **eine einzige Person** (Nadine, Kleinunternehmerin nach § 19 UStG, u. a. Reiki) ihre Einnahmen und Ausgaben per Handy erfasst. Daraus erzeugt die App Monats- und Jahres-PDFs sowie einen Excel-Export als Grundlage für die Steuer.

Leitprinzipien:
- **Ganz einfache Bedienung**: große Buttons, wenig Text, nur Deutsch, keine Fachbegriffe ohne Erklärung.
- **Wartungsfrei**: kein eigener Server und keine Datenbank, die jemand betreuen muss. Sie soll alles selbst bedienen können.
- **Offline zuerst**: Alle Funktionen laufen ohne Netz. Gespeichert wird lokal, mit Google Drive wird im Hintergrund synchronisiert.
- **Daten gehören ihr**: Sie liegen in ihrem eigenen Google Drive als eine JSON-Datei. Drive ist gleichzeitig das Backup.

**Bewusst NICHT im Umfang:** Umsatzsteuer, Belegfotos, wiederkehrende Buchungen, Bankanbindung, mehrere Nutzer, eigenes Backend. Das Datenmodell lässt aber Platz für spätere Belegfotos (siehe `attachments`).

## 2. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Build | Vite + React + TypeScript | Standard, gut wartbar |
| Styling | Tailwind CSS | schnell, mobile-first |
| Lokale Daten | IndexedDB über **Dexie** | offline, robust |
| PWA | `vite-plugin-pwa` (Workbox), `registerType: 'autoUpdate'` | Installierbar, Updates ohne Zutun |
| Login + Drive | Google Identity Services (Token Client) + Drive REST API v3, Scope **`https://www.googleapis.com/auth/drive.file`** | Kein Passwort-Management, „Passwort vergessen“ regelt Google. Die App sieht nur selbst angelegte Dateien |
| PDF | `jspdf` + `jspdf-autotable` | clientseitig |
| Excel | `exceljs` | Formeln und Formatierung im Browser |
| Datum | natives `<input type="date">` | öffnet auf dem Handy den System-Kalender |
| Tests | Vitest | für Geld-Parsing, Summen, Merge-Logik |
| Auslieferung | **GitHub Pages** über GitHub Actions (Push auf `main` → automatisch veröffentlicht) | nur statische Dateien, kein Server, keine Nutzerdaten, kostenlos, wartungsfrei |

Keine weiteren Laufzeit-Abhängigkeiten ohne Rückfrage.

### GitHub Pages – technische Vorgaben
- Die App läuft unter `https://<github-user>.github.io/<repo>/`. In `vite.config.ts` muss `base: '/<repo>/'` gesetzt sein (als Konstante oder aus `VITE_BASE`). Manifest (`start_url`, `scope`) und Service Worker müssen auf diesen Unterpfad zeigen.
- Kein clientseitiges Routing mit echten Pfaden (GitHub Pages hat kein SPA-Fallback). Stattdessen **Hash-Routing** (`#/buchungen`) oder State-basierte Navigation.
- Workflow `.github/workflows/deploy.yml`: bei Push auf `main` → `npm ci` → `npm test` → `npm run build` → Deploy mit `actions/upload-pages-artifact` und `actions/deploy-pages`. Schlagen die Tests fehl, wird nicht veröffentlicht.
- `VITE_GOOGLE_CLIENT_ID` kommt im Workflow aus einer **Repository-Variable** (Settings → Secrets and variables → Actions → Variables). Die Client-ID ist nicht geheim, darf aber trotzdem nicht hart im Code stehen.
- Keine Secrets im Repo. Das Repo darf öffentlich sein (für GitHub Pages bei einem kostenlosen Konto nötig).

## 3. Datenmodell

Beträge werden **immer in Cent als Integer** gespeichert, nie als Float. Datumswerte sind Strings im Format `YYYY-MM-DD` in lokaler Zeit (Europe/Berlin).

```ts
type EntryType = 'einnahme' | 'ausgabe';

interface Entry {
  id: string;            // crypto.randomUUID()
  type: EntryType;
  date: string;          // 'YYYY-MM-DD'
  title: string;         // Bezeichnung, z. B. "Reiki"
  amountCents: number;   // > 0
  categoryId: string | null;
  comment: string;       // optional, darf leer sein
  attachments: never[];  // reserviert für spätere Belegfotos, aktuell immer []
  createdAt: string;     // ISO-Zeitstempel
  updatedAt: string;     // ISO-Zeitstempel, bei jeder Änderung setzen
  deleted: boolean;      // Soft-Delete (Tombstone) für die Synchronisation
}

interface Category {
  id: string;
  name: string;
  type: EntryType;       // Kategorien gelten entweder für Einnahmen oder für Ausgaben
  archived: boolean;     // ausgeblendet, aber für alte Buchungen weiter sichtbar
  sortOrder: number;
  updatedAt: string;
  deleted: boolean;
}

interface Favorite {
  id: string;
  type: EntryType;
  title: string;
  amountCents: number | null;  // null = Betrag wird jedes Mal eingegeben
  categoryId: string | null;
  sortOrder: number;
  updatedAt: string;
  deleted: boolean;
}

interface Settings {
  ownerName: string;          // für den PDF-Kopf
  businessName: string;       // optional
  address: string;            // optional, mehrzeilig
  showKleinunternehmerNote: boolean; // Standard: true
  updatedAt: string;
}

// Datei in Google Drive: "Buchhaltung-Daten.json"
interface SyncFile {
  schemaVersion: 1;
  entries: Entry[];
  categories: Category[];
  favorites: Favorite[];
  settings: Settings;
  lastWriteAt: string;
}
```

**Startkategorien** werden beim ersten Start angelegt und lassen sich bearbeiten:
- Einnahmen: Behandlungen, Kurse/Workshops, Verkauf, Sonstiges
- Ausgaben: Material/Waren, Raumkosten, Fortbildung, Fahrtkosten, Telefon/Internet, Werbung, Versicherungen/Beiträge, Bürobedarf, Sonstiges

## 4. Synchronisation mit Google Drive

- Gearbeitet wird immer lokal in IndexedDB, Drive ist nur Spiegel und Backup.
- Es gibt eine einzige Datei `Buchhaltung-Daten.json`, die die App anlegt. Die `fileId` wird lokal gespeichert. Auf einem neuen Gerät wird die Datei per `files.list` gesucht (`name='Buchhaltung-Daten.json' and trashed=false`).
- **Merge-Regel**: Datensätze werden über die `id` zusammengeführt, es gewinnt der höhere `updatedAt` (last-write-wins). Gelöscht wird nur per `deleted: true`, nie hart, damit Löschungen auch auf anderen Geräten ankommen.
- **Ablauf beim Sync**: Remote-Datei laden → mit lokalen Daten mergen → lokal speichern → Ergebnis hochladen. Mit `If-Match`/ETag-Prüfung bzw. erneutem Laden bei Konflikt, damit bei zwei Geräten nichts überschrieben wird.
- **Auslöser**: App-Start, Rückkehr in die App (`visibilitychange`), Event `online` und 3 Sekunden nach der letzten Änderung (Debounce).
- **Status-Anzeige** im Dashboard, klein und unaufdringlich: „Gesichert ✓“, „Wird gesichert …“, „Offline – wird später gesichert“ oder „Bitte erneut mit Google verbinden“ (antippbar).
- Drive hält Datei-Revisionen von selbst vor. Zusätzlich gibt es in den Einstellungen **„Backup herunterladen“** (JSON) und **„Backup einspielen“** (mit deutlicher Warnung, Merge statt Überschreiben).
- `navigator.storage.persist()` beim Start anfragen.

### Auth-Details
- Google Identity Services Token Client mit Scope `drive.file`. Das Access-Token gilt etwa 1 Stunde und wird bei Bedarf still erneuert (`prompt: ''`).
- Schlägt die stille Erneuerung fehl, läuft die App normal weiter. Es erscheint nur der Hinweis „Bitte erneut mit Google verbinden“.
- Beim ersten Start ist der Google-Login Pflicht (Onboarding). Danach bleibt sie angemeldet wie in jeder anderen App.
- Im Code liegt das Auth-Modul hinter einer eigenen Schnittstelle (`auth.ts`), damit sich der Mechanismus austauschen lässt (siehe Risiko iOS in Abschnitt 9).
- Die Client-ID kommt aus `VITE_GOOGLE_CLIENT_ID` (`.env`, nicht committen, `.env.example` anlegen).

## 5. Screens und Bedienung

Navigation über eine **Bottom-Bar** mit vier Punkten: Übersicht · Buchungen · Berichte · Einstellungen.

### 5.1 Onboarding (nur beim ersten Start)
1. Begrüßung, kurzer Satz, was die App macht.
2. Button „Mit Google anmelden“ mit dem Hinweis „Deine Daten werden in deinem Google Drive gesichert. Die App sieht nur ihre eigene Datei.“
3. Name für den PDF-Kopf (optional: Firmenname, Adresse).
4. Fertig → Übersicht. Liegt in Drive schon eine Datendatei, wird sie geladen statt neu angelegt.

### 5.2 Übersicht (Dashboard)
- Oben: Monat und Jahr, mit Pfeilen wechselbar.
- Drei Kacheln: **Einnahmen**, **Ausgaben**, **Ergebnis** (grün oder rot).
- Darunter eine kleine Zeile mit dem Jahr bis heute: Einnahmen, Ausgaben, Ergebnis.
- Zwei große Buttons: **„+ Einnahme“** (grün) und **„+ Ausgabe“** (rot).
- Darunter Favoriten als Chips („Reiki 45 €“). Ein Tipp öffnet das Formular vorausgefüllt mit heutigem Datum.
- Die letzten 5 Buchungen als Liste. Ein Tipp darauf öffnet die Bearbeitung.
- Sync-Status.

### 5.3 Erfassen / Bearbeiten (Bottom-Sheet oder Vollbild)
Felder in dieser Reihenfolge:
1. **Datum**: heute vorausgefüllt, ein Tipp öffnet den Kalender.
2. **Bezeichnung**: Pflichtfeld, mit Autovervollständigung aus früheren Bezeichnungen.
3. **Betrag**: Pflichtfeld, `inputmode="decimal"`, akzeptiert „45“, „45,5“, „45,50“ und „1.234,56“. Größer als 0.
4. **Kategorie**: Auswahl aus den aktiven Kategorien des Typs, darin ein Eintrag „+ Neue Kategorie“.
5. **Kommentar**: optional, mehrzeilig.

Buttons: „Speichern“ (groß) und „Abbrechen“. Im Bearbeiten-Modus zusätzlich „Löschen“.
Nach dem Speichern: kurzer Toast „Gespeichert“, zurück zur vorherigen Ansicht.
Wird eine Bezeichnung erfasst, die es noch nicht als Favorit gibt, bietet die App dezent an: „Als Favorit merken?“ (optional, nicht aufdringlich).

### 5.4 Buchungen
- Monatswechsler oben, Umschalter Alle / Einnahmen / Ausgaben, Suchfeld (Bezeichnung und Kommentar).
- Liste gruppiert nach Tag: Bezeichnung, Kategorie, Betrag (Einnahme grün mit +, Ausgabe rot mit −), Kommentar-Icon, falls vorhanden.
- Ein Tipp öffnet die Bearbeitung.
- **Löschen**: Rückfrage „Buchung wirklich löschen?“, danach Toast mit **„Rückgängig“** (ca. 6 Sekunden).
- Monatssummen am Listenende, wie in ihrer Excel: Summe Einnahmen, Summe Ausgaben, Ergebnis.

### 5.5 Berichte
- Auswahl: **Monat** (Monat + Jahr) oder **Jahr**.
- Buttons: **„PDF erstellen“** und **„Excel erstellen“**.
- Ausgabe über die Web Share API (`navigator.share` mit Datei), sonst als Download. So kann sie die Datei an den Steuerberater schicken, in Drive speichern usw.
- Dateinamen: `Buchhaltung_2026-01.pdf`, `Buchhaltung_2026.pdf`, `Buchhaltung_2026.xlsx`.

### 5.6 Einstellungen
- **Kategorien**: getrennte Listen für Einnahmen und Ausgaben. Anlegen, umbenennen, Reihenfolge ändern, ausblenden. Löschen geht nur, wenn die Kategorie nie benutzt wurde, sonst nur ausblenden (mit erklärendem Hinweis).
- **Favoriten**: anlegen, bearbeiten, löschen, sortieren.
- **Meine Angaben**: Name, Firmenname, Adresse, Schalter für den Kleinunternehmer-Hinweis.
- **Google-Konto & Sicherung**: verbundenes Konto, letzter Sync, „Jetzt sichern“, „Abmelden“.
- **Backup herunterladen / einspielen**.
- **Hilfe**: kurze FAQ (siehe Abschnitt 8).
- App-Version.

## 6. Berichte im Detail

### 6.1 PDF Monat
- Kopf: Name/Firmenname, Adresse, „Einnahmen-Überschuss-Übersicht Januar 2026“, Erstelldatum.
- Wenn aktiv: „Kleinunternehmerin gem. § 19 UStG – es wird keine Umsatzsteuer ausgewiesen.“
- Tabelle Einnahmen: Datum, Bezeichnung, Kategorie, Kommentar, Betrag. Summe.
- Tabelle Ausgaben: gleiche Spalten. Summe.
- Block **Summen je Kategorie** (Einnahmen und Ausgaben getrennt).
- **Ergebnis** = Einnahmen − Ausgaben, hervorgehoben.
- Seitenzahlen „Seite x von y“. A4 hochformat, sauber lesbar.

### 6.2 PDF Jahr
- Kopf wie oben, „Jahresübersicht 2026“.
- Monatstabelle: 12 Zeilen (Monat, Einnahmen, Ausgaben, Ergebnis) plus Jahressumme.
- Summen je Kategorie fürs ganze Jahr.
- Anhang: alle Einzelbuchungen chronologisch (Datum, Typ, Bezeichnung, Kategorie, Kommentar, Betrag).

### 6.3 Excel (immer ein Jahr)
- **Ein Blatt pro Monat** („Januar 2026“ …), angelehnt an ihre bisherige Vorlage:
  - A1 Monatsname, Einnahmen-Block links (Datum, Bezeichnung, Kategorie, Betrag, Kommentar), Ausgaben-Block rechts mit Abstandsspalte.
  - Darunter „Summe“ als **echte Formel** (`=SUMME(...)`), „Ergebnis“ als Formel.
  - Euro-Zahlenformat `#,##0.00 €`, Datum als echtes Excel-Datum `TT.MM.JJJJ`, Rahmen wie im Original.
- Blatt **„Jahresübersicht“**: Monate × Einnahmen/Ausgaben/Ergebnis mit Formeln auf die Monatsblätter, dazu Kategoriesummen.
- Blatt **„Alle Buchungen“**: flache Tabelle (Datum, Typ, Bezeichnung, Kategorie, Betrag, Kommentar) mit Autofilter, praktisch für den Steuerberater.

## 7. Qualitätsanforderungen

- **Zeitzone**: Datum nie über `toISOString()` erzeugen, das gibt UTC und verschiebt Daten. Eine eigene Hilfsfunktion `todayLocal()` / `formatDateLocal()` verwenden und testen.
- **Geld**: nur Integer-Cent, Formatierung über `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`.
- **Mobile-first**: Zielbreite 360–430 px, Touch-Targets ≥ 44 px, Eingabefelder ≥ 16 px Schrift (verhindert Zoom auf iOS), Safe-Area-Insets beachten.
- **Barrierearm**: ausreichende Kontraste, Labels an allen Feldern.
- **Fehlertexte** auf Deutsch und verständlich, nie technische Fehlermeldungen anzeigen.
- **PWA**: Manifest (Name „Buchhaltung“, Icons 192/512 + maskable, `display: standalone`, Theme-Farbe), Service Worker cacht die App-Shell. Updates laufen automatisch, mit dezentem Hinweis „Neue Version geladen“.
- **Tests (Vitest)**: Betrags-Parsing (de-DE), Monats- und Jahressummen, Kategoriesummen, Merge-Logik (inkl. Löschung und Konflikt), Datums-Hilfsfunktionen.
- Keine Analytics, kein Tracking, keine externen Fonts von CDNs (alles lokal bündeln).

## 8. Hilfe-Texte (in der App)
- Wie erfasse ich eine Einnahme/Ausgabe?
- Wie lege ich eine Kategorie oder einen Favoriten an?
- Wie bekomme ich mein Monats-/Jahres-PDF?
- Wo sind meine Daten? → „In deinem Google Drive in der Datei Buchhaltung-Daten.json. Bitte nicht löschen oder umbenennen.“
- Neues Handy? → „App öffnen, mit demselben Google-Konto anmelden, fertig.“
- Passwort vergessen? → „Das ist dein Google-Passwort, Zurücksetzen über Google.“

## 9. Risiken / zuerst prüfen

1. **Google-Login in installierter iOS-PWA**: Popups verhalten sich im Standalone-Modus auf iOS teils unzuverlässig. **In Phase 1 als Erstes auf echtem iPhone UND Android testen** (installiert auf dem Home-Bildschirm). Fallback: eigener Redirect-basierter OAuth-Flow (`response_type=token`, Redirect zurück auf die App-URL, Token aus dem URL-Fragment lesen). Deshalb das Auth-Modul abstrahieren.
2. **Token-Laufzeit 1 h**: Die App muss ohne gültiges Token voll funktionieren. Sync wird nur verschoben.
3. **Zwei Geräte gleichzeitig**: wird durch Merge per `updatedAt` + Tombstones abgedeckt, in Tests absichern.
4. **Datei in Drive gelöscht/umbenannt**: Die App erkennt das und legt die Datei aus den lokalen Daten neu an, mit Hinweis.

## 10. Phasen (nach jeder Phase anhalten und Freigabe abwarten)

**Phase 1 – Gerüst & Auth-Spike**
Vite/React/TS/Tailwind, PWA-Grundgerüst mit `base`-Pfad für GitHub Pages, Manifest/Icons (Platzhalter), Deploy-Workflow, Google-Login mit `drive.file`, Test-Datei in Drive anlegen und lesen.
*Abnahme:* Ein Push auf `main` veröffentlicht automatisch auf GitHub Pages. Die App ist auf iPhone und Android installierbar, der Login funktioniert in der installierten App, und eine Datei wird in Drive geschrieben und gelesen.

**Phase 2 – Datenhaltung & Erfassen**
Dexie-Schema, Startkategorien, Erfassen/Bearbeiten/Löschen inkl. Rückgängig, Betrags-Parsing, Datum lokal. Tests.
*Abnahme:* Buchungen offline anlegen, bearbeiten, löschen und rückgängig machen. Tests grün.

**Phase 3 – Übersicht, Buchungsliste, Favoriten, Kategorien-Verwaltung**
*Abnahme:* Dashboard-Summen stimmen, Monatswechsel, Suche/Filter, Favoriten erfassen per Tipp, Kategorien anlegen/umbenennen/ausblenden.

**Phase 4 – Synchronisation**
Merge-Logik, Auslöser, Statusanzeige, Konfliktfall, neues Gerät, gelöschte Drive-Datei, Backup-Download/-Import. Tests.
*Abnahme:* Zwei Browser mit demselben Konto bleiben konsistent, offline erfasste Buchungen kommen nach Reconnect an.

**Phase 5 – Berichte**
PDF Monat, PDF Jahr, Excel (Monatsblätter mit Formeln, Jahresübersicht, Alle Buchungen), Teilen/Download.
*Abnahme:* Beispieljahr mit Testdaten → PDF und Excel in Excel/LibreOffice geöffnet, Summen stimmen mit der App überein.

**Phase 6 – Feinschliff & Übergabe**
Onboarding, Einstellungen, Hilfe-Seite, Fehlertexte, echte Icons, Lighthouse-PWA-Check, README mit Deployment-Anleitung.
*Abnahme:* Frische Installation ohne Vorwissen bedienbar, README vollständig.

## 11. Manuelle Schritte (macht Johannes, nicht Claude Code)

Alles läuft in **Johannes' eigenen Konten**. Zugriff auf Nadines Google-Konto ist nie nötig: Sie meldet sich nur selbst an, die App legt die Datendatei automatisch in ihrem Drive an.

**A) GitHub (einmalig, ca. 5 Min.)**
1. Neues **öffentliches** Repo anlegen, z. B. `buchhaltung`. Es enthält keine Daten und keine Secrets.
2. Settings → Pages → Source: **„GitHub Actions“**.
3. Die App-Adresse ist dann `https://<dein-github-user>.github.io/buchhaltung/`.

**B) Google Cloud Console (einmalig, ca. 20 Min., mit deinem Google-Konto)**
1. Neues Projekt „Buchhaltung“ anlegen.
2. APIs & Dienste → Bibliothek → **Google Drive API** aktivieren.
3. OAuth-Zustimmungsbildschirm (Google Auth Platform): Nutzertyp **Extern**, App-Name „Buchhaltung“, deine Mail als Support- und Entwickler-Kontakt.
4. Datenzugriff → Scope **`.../auth/drive.file`** hinzufügen. Das ist ein nicht-sensibler Scope, deshalb ist keine Google-Prüfung nötig.
5. Clients → **OAuth-Client-ID** vom Typ „Webanwendung“ anlegen. Autorisierte JavaScript-Quellen: `https://<dein-github-user>.github.io` (nur der Host, ohne Pfad) und `http://localhost:5173`. Falls der Redirect-Fallback gebraucht wird, zusätzlich die Weiterleitungs-URI `https://<dein-github-user>.github.io/buchhaltung/`.
6. Zielgruppe → Veröffentlichungsstatus auf **„In Produktion“** stellen. Sonst darf sich nur anmelden, wer als Testnutzer eingetragen ist.
7. Client-ID kopieren → im GitHub-Repo unter Settings → Secrets and variables → Actions → **Variables** als `VITE_GOOGLE_CLIENT_ID` speichern. Lokal zusätzlich in `.env`.

**C) Übergabe an Nadine**
- Link schicken. iPhone: in **Safari** öffnen → Teilen → „Zum Home-Bildschirm“. Android: in Chrome öffnen → „App installieren“.
- App öffnen → „Mit Google anmelden“ → Zugriff erlauben. Fertig, ab da läuft alles automatisch.

**Langfristig beachten:** Das Google-Cloud-Projekt und das GitHub-Repo nicht löschen, sonst funktioniert der Login nicht mehr. Ihre Daten in Drive blieben aber erhalten.

## 12. Später möglich (nicht jetzt bauen)
Belegfotos (in Drive-Unterordner, `attachments` ist vorbereitet), wiederkehrende Buchungen, Monatsabschluss/Sperre, Kilometer-/Fahrtenerfassung, Ablage der Berichte direkt in einen Drive-Ordner.
