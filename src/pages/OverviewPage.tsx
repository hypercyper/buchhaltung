import { activeCategories, activeEntries, activeFavorites, entriesBetween } from '../data/repo';
import { useLive } from '../data/useLive';
import { openNewEntry } from '../entry/editor';
import { EntryRow } from '../entry/EntryList';
import { formatEuro } from '../lib/money';
import { monthRange, todayLocal, type YearMonth } from '../lib/date';
import { totals } from '../lib/summary';
import { MonthSwitcher } from '../ui/MonthSwitcher';
import { SyncBadge } from '../ui/SyncBadge';

function Tile({ label, cents, tone }: { label: string; cents: number; tone: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-3 text-center">
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`mt-1 text-base font-bold tabular-nums break-words ${tone}`}>{formatEuro(cents)}</div>
    </div>
  );
}

export function OverviewPage({ month, onMonthChange }: { month: YearMonth; onMonthChange: (m: YearMonth) => void }) {
  const [from, to] = monthRange(month);
  const monthEntries = useLive(() => entriesBetween(from, to), [from, to], []);
  const yearToDate = useLive(
    () => entriesBetween(`${month.year}-01-01`, `${month.year}-12-31`).then((es) => es.filter((e) => e.date <= todayLocal())),
    [month.year],
    [],
  );
  const recent = useLive(
    () => activeEntries().then((es) => es.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)),
    [],
    [],
  );
  const favorites = useLive(activeFavorites, [], []);
  const categories = useLive(activeCategories, [], []);

  const m = totals(monthEntries);
  const y = totals(yearToDate);
  const resultTone = (c: number) => (c >= 0 ? 'text-emerald-700' : 'text-red-700');

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <SyncBadge />
      </div>
      <MonthSwitcher value={month} onChange={onMonthChange} />

      <div className="grid grid-cols-3 gap-2">
        <Tile label="Einnahmen" cents={m.income} tone="text-emerald-700" />
        <Tile label="Ausgaben" cents={m.expense} tone="text-red-700" />
        <Tile label="Ergebnis" cents={m.result} tone={resultTone(m.result)} />
      </div>
      <p className="-mt-2 text-center text-sm text-gray-600">
        {month.year} bis heute: Einnahmen {formatEuro(y.income)} · Ausgaben {formatEuro(y.expense)} · Ergebnis{' '}
        <span className={`font-semibold ${resultTone(y.result)}`}>{formatEuro(y.result)}</span>
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button className="btn min-h-16 bg-emerald-700 text-white" onClick={() => openNewEntry('einnahme')}>
          + Einnahme
        </button>
        <button className="btn min-h-16 bg-red-700 text-white" onClick={() => openNewEntry('ausgabe')}>
          + Ausgabe
        </button>
      </div>

      {favorites.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-gray-600">Favoriten</h2>
          <div className="flex flex-wrap gap-2">
            {favorites.map((f) => (
              <button
                key={f.id}
                onClick={() => openNewEntry(f.type, f)}
                className={`min-h-11 rounded-full border-2 px-4 font-medium ${
                  f.type === 'einnahme' ? 'border-emerald-700 text-emerald-800' : 'border-red-700 text-red-800'
                }`}
              >
                {f.title}
                {f.amountCents !== null && ` ${formatEuro(f.amountCents)}`}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-600">Zuletzt erfasst</h2>
        {recent.length === 0 ? (
          <p className="text-gray-600">Noch keine Buchungen. Tippe auf „+ Einnahme“ oder „+ Ausgabe“.</p>
        ) : (
          <div className="divide-y divide-gray-200 rounded-2xl border border-gray-200 px-3">
            {recent.map((e) => (
              <EntryRow key={e.id} entry={e} categories={categories} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
