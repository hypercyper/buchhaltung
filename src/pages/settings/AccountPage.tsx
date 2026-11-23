// Google account, sync and backup (PLAN.md §5.6).
import { useRef, useState } from 'react';
import { getPreferredMethod, setPreferredMethod, type AuthMethod } from '../../auth';
import { notifyLocalChange } from '../../data/changes';
import { exportAll, importMerged } from '../../data/repo';
import { todayLocal } from '../../lib/date';
import { JSON_MIME, shareOrDownload } from '../../lib/share';
import { validateSyncFile } from '../../sync/merge';
import { connectGoogle, disconnectGoogle, syncNow, useSyncStatus, type SyncState } from '../../sync/sync';
import { confirmDialog } from '../../ui/confirm';
import { showToast } from '../../ui/toast';
import { SubPage } from './SubPage';

const STATE_TEXT: Record<SyncState, string> = {
  idle: '–',
  syncing: 'Wird gesichert …',
  ok: 'Gesichert ✓',
  offline: 'Offline – wird später gesichert',
  auth: 'Nicht verbunden',
  error: 'Letzte Sicherung hat nicht geklappt',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return 'noch nie';
  return new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function AccountPage() {
  const status = useSyncStatus();
  const [method, setMethod] = useState<AuthMethod>(getPreferredMethod);
  const fileInput = useRef<HTMLInputElement>(null);
  const connected = status.state !== 'auth' && !!status.email;

  async function connect() {
    try {
      await connectGoogle();
      await syncNow();
      showToast('Mit Google verbunden');
    } catch {
      showToast('Verbindung mit Google hat nicht geklappt. Bitte nochmal versuchen.');
    }
  }

  async function disconnect() {
    const ok = await confirmDialog('Von Google abmelden?', {
      detail: 'Deine Daten bleiben auf diesem Handy und in Google Drive. Gesichert wird erst wieder, wenn du dich anmeldest.',
      okLabel: 'Abmelden',
    });
    if (ok) disconnectGoogle();
  }

  function chooseMethod(next: AuthMethod) {
    setMethod(next);
    setPreferredMethod(next);
  }

  async function downloadBackup() {
    const data = await exportAll();
    await shareOrDownload(JSON.stringify(data, null, 2), `Buchhaltung-Backup_${todayLocal()}.json`, JSON_MIME);
  }

  async function importBackup(file: File) {
    try {
      const data = validateSyncFile(JSON.parse(await file.text()));
      const ok = await confirmDialog('Backup einspielen?', {
        detail: `Die Datei enthält ${data.entries.filter((e) => !e.deleted).length} Buchungen. Sie wird mit deinen jetzigen Daten zusammengeführt – es wird nichts überschrieben, was neuer ist. Bitte nur eigene Backups dieser App einspielen.`,
        okLabel: 'Einspielen',
      });
      if (!ok) return;
      await importMerged(data);
      notifyLocalChange();
      showToast('Backup eingespielt');
    } catch (error) {
      showToast(error instanceof Error && error.message.includes('gültige') ? error.message : 'Die Datei konnte nicht gelesen werden.', undefined, 4500);
    }
  }

  return (
    <SubPage title="Google-Konto & Sicherung">
      <section className="card flex flex-col gap-2">
        <div>
          <div className="text-sm text-gray-600">Verbundenes Konto</div>
          <div className="font-medium break-all">{connected ? status.email : 'nicht verbunden'}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Status</div>
          <div className="font-medium">{STATE_TEXT[status.state]}</div>
        </div>
        <div>
          <div className="text-sm text-gray-600">Zuletzt gesichert</div>
          <div className="font-medium">{formatTimestamp(status.lastSyncAt)}</div>
        </div>
        {connected ? (
          <div className="mt-2 flex gap-2">
            <button className="btn flex-1 bg-teal-700 text-white" disabled={status.state === 'syncing'} onClick={() => void syncNow()}>
              Jetzt sichern
            </button>
            <button className="btn flex-1 bg-gray-200" onClick={disconnect}>
              Abmelden
            </button>
          </div>
        ) : (
          <button className="btn mt-2 bg-teal-700 text-white" onClick={connect}>
            Mit Google anmelden
          </button>
        )}
      </section>

      <section className="card flex flex-col gap-3">
        <h2 className="text-lg font-bold">Backup</h2>
        <p className="text-sm text-gray-600">
          Deine Daten werden automatisch in Google Drive gesichert. Hier kannst du zusätzlich eine Kopie als Datei
          speichern.
        </p>
        <button className="btn bg-gray-200" onClick={downloadBackup}>
          Backup herunterladen
        </button>
        <button className="btn bg-gray-200" onClick={() => fileInput.current?.click()}>
          Backup einspielen
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void importBackup(file);
          }}
        />
      </section>

      <details className="card">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">Probleme bei der Anmeldung?</summary>
        <p className="mt-2 text-sm text-gray-600">
          Wenn sich das Google-Fenster nicht öffnet oder hängen bleibt, probiere den anderen Anmeldeweg und melde dich
          danach neu an.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
          {(['popup', 'redirect'] as const).map((m) => (
            <button
              key={m}
              onClick={() => chooseMethod(m)}
              className={`min-h-11 rounded-lg ${method === m ? 'bg-white font-semibold shadow' : 'text-gray-700'}`}
            >
              {m === 'popup' ? 'Fenster' : 'Weiterleitung'}
            </button>
          ))}
        </div>
      </details>
    </SubPage>
  );
}
