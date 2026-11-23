// Phase 1 test page: verifies install, Google login and Drive read/write on real devices.
// Replaced by the real app in phase 2.
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  AuthMethod,
  getAccessToken,
  getAuthProvider,
  getClientId,
  getPreferredMethod,
  loadToken,
  redirectUri,
  setPreferredMethod,
} from '../auth';
import { DriveError, createJsonFile, findFileByName, readJsonFile, updateJsonFile } from '../drive/drive';

const TEST_FILE = 'Buchhaltung-Test.json';

function displayMode(): string {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return standalone ? 'Installiert (Home-Bildschirm)' : 'Im Browser';
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return 'iPhone/iPad';
  if (/Android/.test(ua)) return 'Android';
  return 'Computer';
}

function time(): string {
  return new Date().toLocaleTimeString('de-DE');
}

export function SpikePage({ cameBackFromRedirect }: { cameBackFromRedirect: boolean }) {
  const [method, setMethod] = useState<AuthMethod>(getPreferredMethod);
  const [token, setToken] = useState(getAccessToken);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { needRefresh, offlineReady } = useRegisterSW();

  const add = (line: string) => setLog((prev) => [`${time()}  ${line}`, ...prev]);

  useEffect(() => {
    if (cameBackFromRedirect) add('✓ Zurück von Google (Weiterleitung), angemeldet');
  }, [cameBackFromRedirect]);

  const chooseMethod = (next: AuthMethod) => {
    setMethod(next);
    setPreferredMethod(next);
  };

  async function run(label: string, action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      add(`✗ ${label}: ${message}`);
      if (error instanceof DriveError && error.needsAuth) setToken(null);
    } finally {
      setBusy(false);
    }
  }

  const signIn = () =>
    run('Anmelden', async () => {
      await getAuthProvider(method).signIn();
      setToken(getAccessToken());
      add(`✓ Angemeldet per ${method === 'popup' ? 'Popup' : 'Weiterleitung'}`);
    });

  const silent = () =>
    run('Still erneuern', async () => {
      const ok = await getAuthProvider(method).trySilentRefresh();
      setToken(getAccessToken());
      add(ok ? '✓ Token still erneuert' : '✗ Stille Erneuerung nicht möglich');
    });

  const write = () =>
    run('Schreiben', async () => {
      const t = getAccessToken();
      if (!t) throw new Error('Nicht angemeldet');
      const data = { geschrieben: new Date().toISOString(), geraet: deviceLabel(), modus: displayMode() };
      const existing = await findFileByName(t, TEST_FILE);
      const meta = existing ? await updateJsonFile(t, existing.id, data) : await createJsonFile(t, TEST_FILE, data);
      add(`✓ ${existing ? 'Aktualisiert' : 'Angelegt'}: ${meta.name} (${meta.id.slice(0, 8)}…)`);
    });

  const read = () =>
    run('Lesen', async () => {
      const t = getAccessToken();
      if (!t) throw new Error('Nicht angemeldet');
      const existing = await findFileByName(t, TEST_FILE);
      if (!existing) {
        add('– Keine Testdatei in Drive gefunden');
        return;
      }
      const data = await readJsonFile<Record<string, string>>(t, existing.id);
      add(`✓ Gelesen: ${JSON.stringify(data)}`);
    });

  const signOut = () => {
    getAuthProvider(method).signOut();
    setToken(null);
    add('Abgemeldet');
  };

  const expiresAt = loadToken()?.expiresAt;
  const button = 'min-h-12 w-full rounded-xl px-4 text-lg font-semibold disabled:opacity-40';

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Buchhaltung – Test (Phase 1)</h1>

      <section className="rounded-xl bg-gray-100 p-3 text-sm leading-6">
        <div>Gerät: <b>{deviceLabel()}</b></div>
        <div>Modus: <b>{displayMode()}</b></div>
        <div>Client-ID: <b>{getClientId() ? 'gesetzt' : 'FEHLT'}</b></div>
        <div>Redirect-Adresse: <code className="break-all">{redirectUri()}</code></div>
        <div>
          Anmeldung:{' '}
          <b>{token ? `ja, gültig bis ${new Date(expiresAt!).toLocaleTimeString('de-DE')}` : 'nein'}</b>
        </div>
        <div>Offline bereit: <b>{offlineReady[0] ? 'ja' : 'noch nicht'}</b>{needRefresh[0] && ' · Neue Version geladen'}</div>
      </section>

      <fieldset className="flex gap-2">
        <legend className="mb-1 text-sm font-medium">Anmeldeweg</legend>
        {(['popup', 'redirect'] as const).map((m) => (
          <button
            key={m}
            onClick={() => chooseMethod(m)}
            className={`min-h-12 flex-1 rounded-xl border-2 text-base ${
              method === m ? 'border-teal-700 bg-teal-50 font-semibold' : 'border-gray-300'
            }`}
          >
            {m === 'popup' ? 'Popup (Standard)' : 'Weiterleitung'}
          </button>
        ))}
      </fieldset>

      <button className={`${button} bg-teal-700 text-white`} disabled={busy} onClick={signIn}>
        Mit Google anmelden
      </button>
      <button className={`${button} bg-gray-200`} disabled={busy || !token} onClick={write}>
        Testdatei schreiben
      </button>
      <button className={`${button} bg-gray-200`} disabled={busy || !token} onClick={read}>
        Testdatei lesen
      </button>
      <div className="flex gap-2">
        <button className={`${button} bg-gray-100 text-base`} disabled={busy} onClick={silent}>
          Still erneuern
        </button>
        <button className={`${button} bg-gray-100 text-base`} disabled={busy || !token} onClick={signOut}>
          Abmelden
        </button>
      </div>

      <section aria-label="Protokoll" className="rounded-xl border border-gray-200 p-3 font-mono text-xs leading-5">
        {log.length === 0 ? <span className="text-gray-500">Noch keine Aktionen.</span> : log.map((l, i) => (
          <div key={i} className="break-all">{l}</div>
        ))}
      </section>
    </main>
  );
}
