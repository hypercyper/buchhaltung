// Sync engine (PLAN.md §4): local IndexedDB is the truth, Drive is mirror + backup.
// Flow: load remote → merge → save locally → upload. Conflicts are detected via Drive's
// file `version`: if it changed between download and upload, the round starts over.
import { useSyncExternalStore } from 'react';
import {
  clearToken,
  getAccessToken,
  getAccountEmailHint,
  getAuthProvider,
  getPreferredMethod,
  setAccountEmailHint,
} from '../auth';
import { getKV, setKV } from '../data/db';
import { getChangeCounter, onLocalChange } from '../data/changes';
import { exportAll, importMerged } from '../data/repo';
import { SYNC_FILE_NAME, type SyncFile } from '../data/types';
import {
  DriveError,
  createJsonFile,
  findFileByName,
  getAccountEmail,
  getFileMeta,
  readJsonFile,
  updateJsonFile,
} from '../drive/drive';
import { mergeSyncFiles, sameContent, validateSyncFile } from './merge';

export type SyncState = 'idle' | 'syncing' | 'ok' | 'offline' | 'auth' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: string | null;
  email: string;
  /** One-off hint for the user, e.g. file was recreated. */
  notice: string | null;
  /** Local changes not yet uploaded. */
  pending: boolean;
}

const KEY_FILE_ID = 'sync.fileId';
const KEY_LAST_SYNC = 'sync.lastSyncAt';
const KEY_HAD_FILE = 'sync.hadFile';
const DEBOUNCE_MS = 3000;
const SILENT_RETRY_MS = 5 * 60_000;
const MAX_ATTEMPTS = 3;

// ---------- status store ----------

let status: SyncStatus = {
  state: 'idle',
  lastSyncAt: null,
  email: getAccountEmailHint(),
  notice: null,
  pending: false,
};
const listeners = new Set<() => void>();

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

export function clearNotice(): void {
  setStatus({ notice: null });
}

// ---------- token ----------

let lastSilentAttempt = 0;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

async function ensureToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token) return token;
  // Never connected on this device, or retried recently: don't nag.
  if (!getAccountEmailHint() || Date.now() - lastSilentAttempt < SILENT_RETRY_MS) return null;
  lastSilentAttempt = Date.now();
  const ok = await withTimeout(getAuthProvider(getPreferredMethod()).trySilentRefresh(), 20_000, false);
  return ok ? getAccessToken() : null;
}

/** Interactive connect (must be called from a tap). For redirect, the page navigates away. */
export async function connectGoogle(): Promise<void> {
  await getAuthProvider(getPreferredMethod()).signIn();
  await afterSignIn();
}

/** Call after any successful sign-in (also after returning from a redirect). */
export async function afterSignIn(): Promise<void> {
  const token = getAccessToken();
  if (!token) return;
  try {
    const email = await getAccountEmail(token);
    setAccountEmailHint(email);
    setStatus({ email });
  } catch {
    // Not critical: email is only shown in settings and used as login hint.
  }
  lastSilentAttempt = 0;
}

export function disconnectGoogle(): void {
  getAuthProvider(getPreferredMethod()).signOut();
  setAccountEmailHint('');
  setStatus({ state: 'auth', email: '' });
}

// ---------- sync ----------

let running = false;
let rerun = false;
let syncedCounter = -1;

export async function syncNow(): Promise<void> {
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  try {
    do {
      rerun = false;
      await syncOnce();
    } while (rerun);
  } finally {
    running = false;
  }
}

async function syncOnce(): Promise<void> {
  if (!navigator.onLine) {
    setStatus({ state: 'offline' });
    return;
  }
  const token = await ensureToken();
  if (!token) {
    setStatus({ state: 'auth' });
    return;
  }

  setStatus({ state: 'syncing' });
  const counterAtStart = getChangeCounter();
  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (await syncRound(token)) {
        syncedCounter = counterAtStart;
        const lastSyncAt = new Date().toISOString();
        await setKV(KEY_LAST_SYNC, lastSyncAt);
        setStatus({ state: 'ok', lastSyncAt, pending: getChangeCounter() !== syncedCounter });
        if (getChangeCounter() !== counterAtStart) rerun = true;
        return;
      }
    }
    setStatus({ state: 'error' });
  } catch (error) {
    if (error instanceof DriveError && error.needsAuth) {
      clearToken();
      setStatus({ state: 'auth' });
    } else if (error instanceof TypeError || !navigator.onLine) {
      setStatus({ state: 'offline' }); // fetch failed: network gone
    } else {
      console.error(error);
      setStatus({ state: 'error' });
    }
  }
}

/** One download-merge-upload round. Returns false if Drive changed meanwhile (retry). */
async function syncRound(token: string): Promise<boolean> {
  const storedId = await getKV<string | null>(KEY_FILE_ID, null);
  const hadFile = await getKV<boolean>(KEY_HAD_FILE, false);

  let meta = storedId ? await getFileMeta(token, storedId) : null;
  if (meta?.trashed) meta = null;
  if (!meta) meta = await findFileByName(token, SYNC_FILE_NAME); // new device or id lost

  const remote: SyncFile | null = meta ? validateSyncFile(await readJsonFile(token, meta.id)) : null;
  const merged = mergeSyncFiles(await exportAll(), remote);
  await importMerged(merged);

  if (!meta) {
    const created = await createJsonFile(token, SYNC_FILE_NAME, merged);
    await setKV(KEY_FILE_ID, created.id);
    await setKV(KEY_HAD_FILE, true);
    if (hadFile) {
      setStatus({
        notice: 'Deine Sicherungsdatei in Google Drive fehlte. Sie wurde aus den Daten auf diesem Gerät neu angelegt.',
      });
    }
    return true;
  }

  if (meta.id !== storedId) await setKV(KEY_FILE_ID, meta.id);
  await setKV(KEY_HAD_FILE, true);
  if (remote && sameContent(merged, remote)) return true; // nothing new to upload

  const current = await getFileMeta(token, meta.id);
  if (!current || current.version !== meta.version) return false; // changed by another device
  await updateJsonFile(token, meta.id, merged);
  return true;
}

// ---------- triggers ----------

let started = false;

export async function startSync(): Promise<void> {
  if (started) return;
  started = true;
  setStatus({ lastSyncAt: await getKV<string | null>(KEY_LAST_SYNC, null) });

  let timer: ReturnType<typeof setTimeout> | undefined;
  onLocalChange(() => {
    setStatus({ pending: true });
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), DEBOUNCE_MS);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setStatus({ state: 'offline' }));
  void syncNow();
}
