import { addMonths, monthLabel, type YearMonth } from '../lib/date';

export function MonthSwitcher({ value, onChange }: { value: YearMonth; onChange: (v: YearMonth) => void }) {
  return (
    <div className="flex items-center justify-between">
      <button className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onChange(addMonths(value, -1))}>
        ‹
      </button>
      <h1 className="text-xl font-bold">{monthLabel(value)}</h1>
      <button className="icon-btn" aria-label="Nächster Monat" onClick={() => onChange(addMonths(value, 1))}>
        ›
      </button>
    </div>
  );
}
