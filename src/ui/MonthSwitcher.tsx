import { addMonths, monthLabel, type YearMonth } from '../lib/date';

export function MonthSwitcher({ value, onChange }: { value: YearMonth; onChange: (v: YearMonth) => void }) {
  return (
    <div className="flex items-center justify-between">
      <button className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onChange(addMonths(value, -1))}>
        ‹
      </button>
      <h2 className="text-xl font-bold">{monthLabel(value)}</h2>
      <button className="icon-btn" aria-label="Nächster Monat" onClick={() => onChange(addMonths(value, 1))}>
        ›
      </button>
    </div>
  );
}
