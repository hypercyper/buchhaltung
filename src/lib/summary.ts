// Sums for dashboard, list and reports. Callers pass only non-deleted entries.
import type { Category, Entry, EntryType } from '../data/types';
import { parseDateLocal } from './date';

export interface Totals {
  income: number;
  expense: number;
  result: number;
}

export function totals(entries: Entry[]): Totals {
  let income = 0;
  let expense = 0;
  for (const e of entries) {
    if (e.type === 'einnahme') income += e.amountCents;
    else expense += e.amountCents;
  }
  return { income, expense, result: income - expense };
}

export function entriesOfMonth(entries: Entry[], year: number, month: number): Entry[] {
  return entries.filter((e) => {
    const d = parseDateLocal(e.date);
    return d.year === year && d.month === month;
  });
}

/** 12 rows, index 0 = January. */
export function monthlyTotals(entries: Entry[], year: number): Totals[] {
  return Array.from({ length: 12 }, (_, i) => totals(entriesOfMonth(entries, year, i + 1)));
}

export interface CategorySum {
  categoryId: string | null;
  name: string;
  sum: number;
}

export const NO_CATEGORY = 'Ohne Kategorie';

export function categoryName(categories: Category[], id: string | null): string {
  if (!id) return NO_CATEGORY;
  return categories.find((c) => c.id === id)?.name ?? NO_CATEGORY;
}

/** Sums per category for one type, ordered like the category list, empty categories left out. */
export function categorySums(entries: Entry[], categories: Category[], type: EntryType): CategorySum[] {
  const map = new Map<string, CategorySum>();
  for (const e of entries) {
    if (e.type !== type) continue;
    const name = categoryName(categories, e.categoryId);
    const sum = map.get(name) ?? { categoryId: e.categoryId, name, sum: 0 };
    sum.sum += e.amountCents;
    map.set(name, sum);
  }
  const order = (s: CategorySum) => {
    const c = categories.find((x) => x.id === s.categoryId);
    return c ? c.sortOrder : Number.MAX_SAFE_INTEGER;
  };
  return [...map.values()].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'de'));
}

export function sortByDate(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}
