// Merge rule (PLAN.md §4): records joined by id, higher updatedAt wins (last-write-wins).
// Deletions are tombstones (deleted: true) and win like any other change.
import type { SyncFile } from '../data/types';
import { DEFAULT_SETTINGS } from '../data/types';

interface Versioned {
  id: string;
  updatedAt: string;
}

/** True if `a` should replace `b`. Ties keep `b`. */
export function isNewer(a: { updatedAt: string }, b: { updatedAt: string }): boolean {
  return a.updatedAt > b.updatedAt;
}

export function mergeRecords<T extends Versioned>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of local) byId.set(r.id, r);
  for (const r of remote) {
    const existing = byId.get(r.id);
    if (!existing || isNewer(r, existing)) byId.set(r.id, r);
  }
  return [...byId.values()];
}

export function mergeSyncFiles(local: SyncFile, remote: SyncFile | null): SyncFile {
  if (!remote) return local;
  return {
    schemaVersion: 1,
    entries: mergeRecords(local.entries, remote.entries),
    categories: mergeRecords(local.categories, remote.categories),
    favorites: mergeRecords(local.favorites, remote.favorites),
    settings: isNewer(remote.settings, local.settings) ? remote.settings : local.settings,
    lastWriteAt: local.lastWriteAt > remote.lastWriteAt ? local.lastWriteAt : remote.lastWriteAt,
  };
}

/** Same content (ignoring order and lastWriteAt)? Used to skip needless uploads. */
export function sameContent(a: SyncFile, b: SyncFile): boolean {
  const key = (f: SyncFile) =>
    JSON.stringify([
      [...f.entries].sort(byId),
      [...f.categories].sort(byId),
      [...f.favorites].sort(byId),
      f.settings,
    ]);
  return key(a) === key(b);
}

const byId = (a: Versioned, b: Versioned) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Validates a parsed file (from Drive or a backup). Throws a German message if unusable. */
export function validateSyncFile(data: unknown): SyncFile {
  const f = data as Partial<SyncFile> | null;
  if (!f || typeof f !== 'object' || f.schemaVersion !== 1 || !Array.isArray(f.entries)) {
    throw new Error('Die Datei ist keine gültige Buchhaltungs-Sicherung.');
  }
  return {
    schemaVersion: 1,
    entries: f.entries,
    categories: Array.isArray(f.categories) ? f.categories : [],
    favorites: Array.isArray(f.favorites) ? f.favorites : [],
    settings: f.settings ?? DEFAULT_SETTINGS,
    lastWriteAt: f.lastWriteAt ?? '',
  };
}
