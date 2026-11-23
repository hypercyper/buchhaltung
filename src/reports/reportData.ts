import type { Category, Entry, Settings } from '../data/types';

export interface ReportInput {
  entries: Entry[]; // non-deleted
  categories: Category[]; // including archived (old entries still need names)
  settings: Settings;
  year: number;
  /** today's date 'YYYY-MM-DD' for the "erstellt am" line */
  createdOn: string;
}

export const KU_NOTE = 'Kleinunternehmerin gem. § 19 UStG – es wird keine Umsatzsteuer ausgewiesen.';

export function fileName(year: number, month: number | null, ext: 'pdf' | 'xlsx'): string {
  return month ? `Buchhaltung_${year}-${String(month).padStart(2, '0')}.${ext}` : `Buchhaltung_${year}.${ext}`;
}

/** Header lines: business name / owner name / address lines (empty ones skipped). */
export function headerLines(settings: Settings): string[] {
  return [settings.businessName, settings.ownerName, ...settings.address.split('\n')]
    .map((s) => s.trim())
    .filter(Boolean);
}
