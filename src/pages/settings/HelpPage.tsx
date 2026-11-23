import { SubPage } from './SubPage';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Wie erfasse ich eine Einnahme oder Ausgabe?',
    a: 'Auf der Übersicht auf „+ Einnahme“ oder „+ Ausgabe“ tippen. Bezeichnung und Betrag eintragen, bei Bedarf Datum, Kategorie und Kommentar ändern, dann „Speichern“. Zum Ändern oder Löschen tippst du die Buchung in der Liste an.',
  },
  {
    q: 'Wie lege ich eine Kategorie oder einen Favoriten an?',
    a: 'Unter Einstellungen → Kategorien bzw. Favoriten. Eine neue Kategorie kannst du auch direkt beim Erfassen anlegen („+ Neue Kategorie“). Nach dem Speichern einer Buchung bietet die App außerdem an, sie als Favorit zu merken.',
  },
  {
    q: 'Wie bekomme ich mein Monats- oder Jahres-PDF?',
    a: 'Unten auf „Berichte“ tippen, Monat oder Jahr wählen und „PDF erstellen“ drücken. Danach kannst du die Datei teilen, z. B. per Mail an den Steuerberater, oder speichern. „Excel erstellen“ liefert das ganze Jahr als Tabelle.',
  },
  {
    q: 'Wo sind meine Daten?',
    a: 'In deinem Google Drive in der Datei Buchhaltung-Daten.json. Bitte nicht löschen oder umbenennen. Zusätzlich liegen sie auf deinem Handy, deshalb funktioniert die App auch ohne Internet.',
  },
  {
    q: 'Neues Handy?',
    a: 'App öffnen, mit demselben Google-Konto anmelden, fertig. Deine Daten werden aus Google Drive geladen.',
  },
  {
    q: 'Passwort vergessen?',
    a: 'Das ist dein Google-Passwort. Zurücksetzen geht über Google (accounts.google.com).',
  },
  {
    q: 'Was bedeutet „Offline – wird später gesichert“?',
    a: 'Du hast gerade kein Internet. Alles, was du erfasst, bleibt auf dem Handy gespeichert und wird automatisch gesichert, sobald du wieder online bist.',
  },
];

export function HelpPage() {
  return (
    <SubPage title="Hilfe">
      {FAQ.map((item) => (
        <details key={item.q} className="card">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{item.q}</summary>
          <p className="mt-2 text-gray-700">{item.a}</p>
        </details>
      ))}
    </SubPage>
  );
}
