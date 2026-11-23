// Local date helpers. Never use toISOString() for date values (UTC shift).

export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Date object → 'YYYY-MM-DD' in local time. */
export function formatDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayLocal(): string {
  return formatDateLocal(new Date());
}

export function parseDateLocal(s: string): { year: number; month: number; day: number } {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { year, month, day } = parseDateLocal(s);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

/** '2026-01-05' → '05.01.2026' */
export function formatDateDE(s: string): string {
  const { year, month, day } = parseDateLocal(s);
  return `${pad(day)}.${pad(month)}.${year}`;
}

/** '2026-01-05' → 'Mo, 05.01.2026' */
export function formatDateWithWeekday(s: string): string {
  const { year, month, day } = parseDateLocal(s);
  return `${WEEKDAYS[new Date(year, month - 1, day).getDay()]}, ${formatDateDE(s)}`;
}

export interface YearMonth {
  year: number;
  month: number; // 1–12
}

export function currentYearMonth(): YearMonth {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** '2026-01' */
export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${pad(month)}`;
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Inclusive string range for a month: ['2026-01-01', '2026-01-31']. */
export function monthRange(ym: YearMonth): [string, string] {
  const last = new Date(ym.year, ym.month, 0).getDate();
  return [`${monthKey(ym)}-01`, `${monthKey(ym)}-${pad(last)}`];
}

/** Current timestamp for createdAt/updatedAt (UTC is correct here: it is a point in time, not a date). */
export function nowIso(): string {
  return new Date().toISOString();
}
