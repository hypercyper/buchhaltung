import type { Category, EntryType } from './types';
import { EPOCH } from './types';

const INCOME = ['Behandlungen', 'Kurse/Workshops', 'Verkauf', 'Sonstiges'];
const EXPENSE = [
  'Material/Waren',
  'Raumkosten',
  'Fortbildung',
  'Fahrtkosten',
  'Telefon/Internet',
  'Werbung',
  'Versicherungen/Beiträge',
  'Bürobedarf',
  'Sonstiges',
];

// Deterministic ids: seeding on two devices yields the same records, so sync merges them
// instead of creating duplicates. EPOCH timestamps let any real edit win.
function make(type: EntryType, names: string[]): Category[] {
  return names.map((name, i) => ({
    id: `start-${type}-${i}`,
    name,
    type,
    archived: false,
    sortOrder: i,
    updatedAt: EPOCH,
    deleted: false,
  }));
}

export const START_CATEGORIES: Category[] = [...make('einnahme', INCOME), ...make('ausgabe', EXPENSE)];
