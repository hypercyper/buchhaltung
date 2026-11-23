// Data model, see PLAN.md §3. Amounts always in integer cents, dates 'YYYY-MM-DD' local time.

export type EntryType = 'einnahme' | 'ausgabe';

export interface Entry {
  id: string;
  type: EntryType;
  date: string;
  title: string;
  amountCents: number;
  categoryId: string | null;
  comment: string;
  attachments: never[]; // reserved for receipt photos, always []
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: EntryType;
  archived: boolean;
  sortOrder: number;
  updatedAt: string;
  deleted: boolean;
}

export interface Favorite {
  id: string;
  type: EntryType;
  title: string;
  amountCents: number | null;
  categoryId: string | null;
  sortOrder: number;
  updatedAt: string;
  deleted: boolean;
}

export interface Settings {
  ownerName: string;
  businessName: string;
  address: string;
  showKleinunternehmerNote: boolean;
  updatedAt: string;
}

export interface SyncFile {
  schemaVersion: 1;
  entries: Entry[];
  categories: Category[];
  favorites: Favorite[];
  settings: Settings;
  lastWriteAt: string;
}

export const SYNC_FILE_NAME = 'Buchhaltung-Daten.json';

/** Oldest possible timestamp: any real record wins against defaults. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

export const DEFAULT_SETTINGS: Settings = {
  ownerName: '',
  businessName: '',
  address: '',
  showKleinunternehmerNote: true,
  updatedAt: EPOCH,
};
