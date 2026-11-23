import type { Category, Entry } from '../data/types';
import { formatDateWithWeekday } from '../lib/date';
import { formatSigned } from '../lib/money';
import { categoryName } from '../lib/summary';
import { openEditEntry } from './editor';

export function EntryRow({ entry, categories }: { entry: Entry; categories: Category[] }) {
  const income = entry.type === 'einnahme';
  return (
    <button
      className="flex min-h-14 w-full items-center gap-3 px-1 py-2 text-left active:bg-gray-100"
      onClick={() => openEditEntry(entry)}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">
          {entry.title}
          {entry.comment && (
            <span className="ml-1 text-gray-500" title={entry.comment} aria-label="mit Kommentar">
              💬
            </span>
          )}
        </div>
        <div className="truncate text-sm text-gray-600">{categoryName(categories, entry.categoryId)}</div>
      </div>
      <div className={`shrink-0 font-semibold tabular-nums ${income ? 'text-emerald-700' : 'text-red-700'}`}>
        {formatSigned(entry.amountCents, entry.type)}
      </div>
    </button>
  );
}

/** Entries grouped by day, newest day first. */
export function EntryList({ entries, categories }: { entries: Entry[]; categories: Category[] }) {
  const days = new Map<string, Entry[]>();
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  for (const e of sorted) days.set(e.date, [...(days.get(e.date) ?? []), e]);

  return (
    <div className="flex flex-col gap-3">
      {[...days.entries()].map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-1 text-sm font-semibold text-gray-600">{formatDateWithWeekday(day)}</h3>
          <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white px-3">
            {list.map((e) => (
              <EntryRow key={e.id} entry={e} categories={categories} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
