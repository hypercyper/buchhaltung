// All writes go through here: sets updatedAt, keeps tombstones, notifies sync.
import type { EntityTable } from 'dexie';
import { db, getKV, setKV } from './db';
import { notifyLocalChange } from './changes';
import { START_CATEGORIES } from './seed';
import type { Category, Entry, EntryType, Favorite, Settings, SyncFile } from './types';
import { DEFAULT_SETTINGS } from './types';
import { isNewer } from '../sync/merge';
import { nowIso } from '../lib/date';

const SETTINGS_KEY = 'settings';

// ---------- Entries ----------

export type EntryInput = Pick<Entry, 'type' | 'date' | 'title' | 'amountCents' | 'categoryId' | 'comment'>;

export async function createEntry(input: EntryInput): Promise<Entry> {
  const now = nowIso();
  const entry: Entry = {
    ...input,
    title: input.title.trim(),
    comment: input.comment.trim(),
    id: crypto.randomUUID(),
    attachments: [],
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  await db.entries.add(entry);
  notifyLocalChange();
  return entry;
}

export async function updateEntry(id: string, input: EntryInput): Promise<void> {
  await db.entries.update(id, {
    ...input,
    title: input.title.trim(),
    comment: input.comment.trim(),
    updatedAt: nowIso(),
  });
  notifyLocalChange();
}

export async function setEntryDeleted(id: string, deleted: boolean): Promise<void> {
  await db.entries.update(id, { deleted, updatedAt: nowIso() });
  notifyLocalChange();
}

export async function activeEntries(): Promise<Entry[]> {
  return (await db.entries.toArray()).filter((e) => !e.deleted);
}

export async function entriesBetween(from: string, to: string): Promise<Entry[]> {
  const rows = await db.entries.where('date').between(from, to, true, true).toArray();
  return rows.filter((e) => !e.deleted);
}

/** Distinct earlier titles of a type, most used first (for autocomplete). */
export async function knownTitles(type: EntryType): Promise<string[]> {
  const counts = new Map<string, number>();
  for (const e of await activeEntries()) {
    if (e.type === type) counts.set(e.title, (counts.get(e.title) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

// ---------- Categories ----------

export async function activeCategories(): Promise<Category[]> {
  const rows = await db.categories.orderBy('sortOrder').toArray();
  return rows.filter((c) => !c.deleted);
}

export async function createCategory(type: EntryType, name: string): Promise<Category> {
  const existing = (await activeCategories()).filter((c) => c.type === type);
  const category: Category = {
    id: crypto.randomUUID(),
    name: name.trim(),
    type,
    archived: false,
    sortOrder: existing.length ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0,
    updatedAt: nowIso(),
    deleted: false,
  };
  await db.categories.add(category);
  notifyLocalChange();
  return category;
}

export async function updateCategory(id: string, changes: Partial<Pick<Category, 'name' | 'archived' | 'sortOrder'>>) {
  await db.categories.update(id, { ...changes, updatedAt: nowIso() });
  notifyLocalChange();
}

export async function isCategoryUsed(id: string): Promise<boolean> {
  return (await activeEntries()).some((e) => e.categoryId === id);
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.update(id, { deleted: true, updatedAt: nowIso() });
  notifyLocalChange();
}

/** Swaps sortOrder with the neighbour in the given direction. */
export async function moveItem(table: 'categories' | 'favorites', list: { id: string }[], index: number, delta: -1 | 1) {
  const target = index + delta;
  if (target < 0 || target >= list.length) return;
  const reordered = [...list];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const now = nowIso();
  await db.transaction('rw', db[table], async () => {
    for (let i = 0; i < reordered.length; i++) {
      await db[table].update(reordered[i].id, { sortOrder: i, updatedAt: now });
    }
  });
  notifyLocalChange();
}

/** Seeds start categories once; deterministic ids make this idempotent across devices. */
export async function ensureStartCategories(): Promise<void> {
  if ((await db.categories.count()) > 0) return;
  await db.categories.bulkPut(START_CATEGORIES);
  notifyLocalChange();
}

// ---------- Favorites ----------

export async function activeFavorites(): Promise<Favorite[]> {
  const rows = await db.favorites.orderBy('sortOrder').toArray();
  return rows.filter((f) => !f.deleted);
}

export type FavoriteInput = Pick<Favorite, 'type' | 'title' | 'amountCents' | 'categoryId'>;

export async function createFavorite(input: FavoriteInput): Promise<void> {
  const all = await activeFavorites();
  await db.favorites.add({
    ...input,
    title: input.title.trim(),
    id: crypto.randomUUID(),
    sortOrder: all.length ? Math.max(...all.map((f) => f.sortOrder)) + 1 : 0,
    updatedAt: nowIso(),
    deleted: false,
  });
  notifyLocalChange();
}

export async function updateFavorite(id: string, input: FavoriteInput): Promise<void> {
  await db.favorites.update(id, { ...input, title: input.title.trim(), updatedAt: nowIso() });
  notifyLocalChange();
}

export async function deleteFavorite(id: string): Promise<void> {
  await db.favorites.update(id, { deleted: true, updatedAt: nowIso() });
  notifyLocalChange();
}

// ---------- Settings ----------

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await getKV<Partial<Settings>>(SETTINGS_KEY, {})) };
}

export async function saveSettings(changes: Partial<Omit<Settings, 'updatedAt'>>): Promise<void> {
  await setKV(SETTINGS_KEY, { ...(await getSettings()), ...changes, updatedAt: nowIso() });
  notifyLocalChange();
}

// ---------- Whole data set (sync + backup) ----------

export async function exportAll(): Promise<SyncFile> {
  const [entries, categories, favorites, settings] = await Promise.all([
    db.entries.toArray(),
    db.categories.toArray(),
    db.favorites.toArray(),
    getSettings(),
  ]);
  return { schemaVersion: 1, entries, categories, favorites, settings, lastWriteAt: nowIso() };
}

/**
 * Writes merged data back. Only records that are newer than the local copy are written,
 * so edits made while a sync was running are never overwritten.
 * Returns true if anything changed locally.
 */
export async function importMerged(data: SyncFile): Promise<boolean> {
  return db.transaction('rw', [db.entries, db.categories, db.favorites, db.kv], async () => {
    const changes = [
      await putNewer(db.entries, data.entries),
      await putNewer(db.categories, data.categories),
      await putNewer(db.favorites, data.favorites),
    ];
    if (isNewer(data.settings, await getSettings())) {
      await setKV(SETTINGS_KEY, data.settings);
      changes.push(true);
    }
    return changes.some(Boolean);
  });
}

async function putNewer<T extends { id: string; updatedAt: string }>(
  table: EntityTable<T, 'id'>,
  incoming: T[],
): Promise<boolean> {
  const local = new Map((await table.toArray()).map((r) => [r.id, r]));
  const newer = incoming.filter((r) => {
    const existing = local.get(r.id);
    return !existing || isNewer(r, existing);
  });
  if (newer.length) await table.bulkPut(newer);
  return newer.length > 0;
}
