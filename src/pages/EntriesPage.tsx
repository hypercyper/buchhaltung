import { useState } from 'react';
import { activeCategories, entriesBetween } from '../data/repo';
import type { EntryType } from '../data/types';
import { useLive } from '../data/useLive';
import { EntryList } from '../entry/EntryList';
import { monthRange, type YearMonth } from '../lib/date';
import { formatEuro } from '../lib/money';
import { totals } from '../lib/summary';
import { MonthSwitcher } from '../ui/MonthSwitcher';

type Filter = 'alle' | EntryType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'alle', label: 'Alle' },
  { value: 'einnahme', label: 'Einnahmen' },
  { value: 'ausgabe', label: 'Ausgaben' },
];

export function EntriesPage({ month, onMonthChange }: { month: YearMonth; onMonthChange: (m: YearMonth) => void }) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [search, setSearch] = useState('');
  const [from, to] = monthRange(month);
  const entries = useLive(() => entriesBetween(from, to), [from, to], []);
  const categories = useLive(activeCategories, [], []);

  const needle = search.trim().toLowerCase();
  const visible = entries.filter(
    (e) =>
      (filter === 'alle' || e.type === filter) &&
      (!needle || e.title.toLowerCase().includes(needle) || e.comment.toLowerCase().includes(needle)),
  );
  const sums = totals(entries);

  return (
    <div className="flex flex-col gap-4">
      <MonthSwitcher value={month} onChange={onMonthChange} />

      <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Filter">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="radio"
            aria-checked={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`min-h-11 rounded-lg text-base ${filter === f.value ? 'bg-white font-semibold shadow' : 'text-gray-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div>
        <label className="sr-only" htmlFor="search">Suchen</label>
        <input
          id="search"
          type="search"
          className="field"
          placeholder="Suchen (Bezeichnung, Kommentar)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-gray-600">
          {entries.length === 0 ? 'In diesem Monat gibt es noch keine Buchungen.' : 'Nichts gefunden.'}
        </p>
      ) : (
        <EntryList entries={visible} categories={categories} />
      )}

      <section className="card" aria-label="Monatssummen">
        <div className="flex justify-between py-1">
          <span>Summe Einnahmen</span>
          <span className="font-semibold tabular-nums text-emerald-700">{formatEuro(sums.income)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span>Summe Ausgaben</span>
          <span className="font-semibold tabular-nums text-red-700">{formatEuro(sums.expense)}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-lg">
          <span className="font-bold">Ergebnis</span>
          <span className={`font-bold tabular-nums ${sums.result >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {formatEuro(sums.result)}
          </span>
        </div>
      </section>
    </div>
  );
}
