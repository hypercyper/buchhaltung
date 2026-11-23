import Dexie, { type EntityTable } from 'dexie';
import type { Category, Entry, Favorite } from './types';

/** Key/value store for settings and device-local metadata. */
export interface KV {
  key: string;
  value: unknown;
}

export const db = new Dexie('buchhaltung') as Dexie & {
  entries: EntityTable<Entry, 'id'>;
  categories: EntityTable<Category, 'id'>;
  favorites: EntityTable<Favorite, 'id'>;
  kv: EntityTable<KV, 'key'>;
};

db.version(1).stores({
  entries: 'id, date, type, updatedAt',
  categories: 'id, type, sortOrder',
  favorites: 'id, sortOrder',
  kv: 'key',
});

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const row = await db.kv.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setKV(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}
