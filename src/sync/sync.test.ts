// Integration test of the sync engine against an in-memory fake of the Drive REST API.
import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncFile } from '../data/types';

// ---------- browser globals the code expects ----------
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k),
});
const nav = { onLine: true };
vi.stubGlobal('navigator', nav);

// ---------- fake Drive ----------
interface FakeFile {
  name: string;
  content: string;
  version: number;
  trashed: boolean;
}
const drive = {
  files: new Map<string, FakeFile>(),
  nextId: 1,
  /** Called after a content download; lets a test simulate another device writing meanwhile. */
  afterDownload: null as null | ((id: string) => void),
  uploads: 0,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const meta = (id: string, f: FakeFile) => ({ id, name: f.name, version: String(f.version), trashed: f.trashed });

vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
  const url = new URL(input);
  const method = init.method ?? 'GET';
  const path = url.pathname;
  if (path.endsWith('/about')) return json({ user: { emailAddress: 'nadine@example.com' } });

  if (path === '/upload/drive/v3/files' && method === 'POST') {
    const parts = [...String(init.body).matchAll(/\r\n\r\n([\s\S]*?)\r\n--/g)].map((m) => m[1]);
    const id = `f${drive.nextId++}`;
    const file = { name: JSON.parse(parts[0]).name, content: parts[1], version: 1, trashed: false };
    drive.files.set(id, file);
    drive.uploads++;
    return json(meta(id, file));
  }
  const uploadMatch = path.match(/^\/upload\/drive\/v3\/files\/(.+)$/);
  if (uploadMatch && method === 'PATCH') {
    const file = drive.files.get(uploadMatch[1]);
    if (!file) return json({}, 404);
    file.content = String(init.body);
    file.version++;
    drive.uploads++;
    return json(meta(uploadMatch[1], file));
  }
  if (path === '/drive/v3/files') {
    const name = url.searchParams.get('q')!.match(/name='(.+?)'/)![1];
    const found = [...drive.files.entries()].filter(([, f]) => f.name === name && !f.trashed);
    return json({ files: found.map(([id, f]) => meta(id, f)) });
  }
  const fileMatch = path.match(/^\/drive\/v3\/files\/(.+)$/);
  if (fileMatch) {
    const file = drive.files.get(fileMatch[1]);
    if (!file) return json({ error: 'not found' }, 404);
    if (url.searchParams.get('alt') === 'media') {
      const body = new Response(file.content, { status: 200 });
      drive.afterDownload?.(fileMatch[1]);
      return body;
    }
    return json(meta(fileMatch[1], file));
  }
  throw new Error(`unexpected request ${method} ${input}`);
});

// ---------- modules under test (imported after globals are in place) ----------
let repo: typeof import('../data/repo');
let sync: typeof import('./sync');
let auth: typeof import('../auth/auth');
let db: typeof import('../data/db').db;

beforeAll(async () => {
  repo = await import('../data/repo');
  sync = await import('./sync');
  auth = await import('../auth/auth');
  db = (await import('../data/db')).db;
});

beforeEach(async () => {
  await Promise.all([db.entries.clear(), db.categories.clear(), db.favorites.clear(), db.kv.clear()]);
  drive.files.clear();
  drive.afterDownload = null;
  drive.uploads = 0;
  nav.onLine = true;
  storage.clear();
  auth.saveToken('token', 3600);
  auth.setAccountEmailHint('nadine@example.com');
});

const remoteFile = (): SyncFile => JSON.parse([...drive.files.values()].find((f) => !f.trashed)!.content);
const entryInput = (title: string, amountCents = 1000) => ({
  type: 'einnahme' as const,
  date: '2026-03-01',
  title,
  amountCents,
  categoryId: null,
  comment: '',
});

describe('sync engine', () => {
  it('first sync creates Buchhaltung-Daten.json with local data', async () => {
    await repo.createEntry(entryInput('Reiki'));
    await sync.syncNow();
    expect(drive.files.size).toBe(1);
    expect([...drive.files.values()][0].name).toBe('Buchhaltung-Daten.json');
    expect(remoteFile().entries.map((e) => e.title)).toEqual(['Reiki']);
  });

  it('merges changes from another device, including a deletion', async () => {
    const mine = await repo.createEntry(entryInput('Reiki'));
    await sync.syncNow();

    // Other device: adds an entry and deletes mine (later timestamps).
    const file = remoteFile();
    const later = '2099-01-01T00:00:00.000Z';
    file.entries = [
      { ...file.entries[0], deleted: true, updatedAt: later },
      { ...file.entries[0], id: 'other', title: 'Kurs', updatedAt: later, deleted: false },
    ];
    const stored = [...drive.files.values()][0];
    stored.content = JSON.stringify(file);
    stored.version++;

    await sync.syncNow();
    const local = await db.entries.toArray();
    expect(local.find((e) => e.id === mine.id)?.deleted).toBe(true);
    expect(local.find((e) => e.id === 'other')?.title).toBe('Kurs');
    expect((await repo.activeEntries()).map((e) => e.title)).toEqual(['Kurs']);
  });

  it('does not upload when nothing changed', async () => {
    await repo.createEntry(entryInput('Reiki'));
    await sync.syncNow();
    const uploads = drive.uploads;
    await sync.syncNow();
    expect(drive.uploads).toBe(uploads);
  });

  it('conflict: another device writes during sync → retry, nothing is lost', async () => {
    await repo.createEntry(entryInput('Reiki'));
    await sync.syncNow();
    await repo.createEntry(entryInput('Massage'));

    let fired = false;
    drive.afterDownload = (id) => {
      if (fired) return;
      fired = true;
      const f = drive.files.get(id)!;
      const data: SyncFile = JSON.parse(f.content);
      data.entries.push({ ...data.entries[0], id: 'parallel', title: 'Workshop', updatedAt: '2099-01-01T00:00:00.000Z' });
      f.content = JSON.stringify(data);
      f.version++;
    };

    await sync.syncNow();
    expect(remoteFile().entries.map((e) => e.title).sort()).toEqual(['Massage', 'Reiki', 'Workshop']);
    expect((await repo.activeEntries()).map((e) => e.title).sort()).toEqual(['Massage', 'Reiki', 'Workshop']);
  });

  it('new device finds the existing file by name and loads it', async () => {
    drive.files.set('existing', {
      name: 'Buchhaltung-Daten.json',
      version: 3,
      trashed: false,
      content: JSON.stringify({
        schemaVersion: 1,
        entries: [{ ...entryInput('Alt'), id: 'a1', attachments: [], createdAt: 't', updatedAt: '2026-01-01T00:00:00.000Z', deleted: false }],
        categories: [],
        favorites: [],
        settings: { ownerName: 'Nadine', businessName: '', address: '', showKleinunternehmerNote: true, updatedAt: '2026-01-01T00:00:00.000Z' },
        lastWriteAt: '2026-01-01T00:00:00.000Z',
      }),
    });
    await sync.syncNow();
    expect(drive.files.size).toBe(1);
    expect((await repo.activeEntries()).map((e) => e.title)).toEqual(['Alt']);
    expect((await repo.getSettings()).ownerName).toBe('Nadine');
  });

  it('recreates a deleted Drive file from local data and tells the user', async () => {
    await repo.createEntry(entryInput('Reiki'));
    await sync.syncNow();
    drive.files.clear(); // user deleted the file in Drive
    sync.clearNotice();

    await repo.createEntry(entryInput('Kurs'));
    await sync.syncNow();
    expect(drive.files.size).toBe(1);
    expect(remoteFile().entries).toHaveLength(2);
  });

  it('without token: status asks to reconnect, data stays local', async () => {
    auth.clearToken();
    auth.setAccountEmailHint(''); // no silent refresh possible
    await repo.createEntry(entryInput('Reiki'));
    await sync.syncNow();
    expect(drive.files.size).toBe(0);
    expect(await repo.activeEntries()).toHaveLength(1);
  });

  it('offline: nothing is sent, next online sync uploads', async () => {
    nav.onLine = false;
    await repo.createEntry(entryInput('Offline erfasst'));
    await sync.syncNow();
    expect(drive.files.size).toBe(0);
    nav.onLine = true;
    await sync.syncNow();
    expect(remoteFile().entries.map((e) => e.title)).toEqual(['Offline erfasst']);
  });

  it('importMerged never overwrites a newer local edit', async () => {
    const e = await repo.createEntry(entryInput('Neu'));
    const stale = { ...(await repo.exportAll()) };
    stale.entries = stale.entries.map((x) => ({ ...x, title: 'Alt', updatedAt: '2000-01-01T00:00:00.000Z' }));
    await repo.importMerged(stale);
    expect((await db.entries.get(e.id))?.title).toBe('Neu');
  });
});
