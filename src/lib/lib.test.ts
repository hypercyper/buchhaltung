import { describe, expect, it } from 'vitest';
import { centsToInput, formatEuro, parseAmount } from './money';
import { addMonths, formatDateDE, formatDateLocal, isValidDate, monthRange } from './date';
import { categorySums, monthlyTotals, totals } from './summary';
import type { Category, Entry } from '../data/types';

describe('parseAmount', () => {
  it.each([
    ['45', 4500],
    ['45,5', 4550],
    ['45,50', 4550],
    ['1.234,56', 123456],
    ['1234,56', 123456],
    ['12.5', 1250],
    ['12.50', 1250],
    ['1.234', 123400],
    [' 45 € ', 4500],
    ['0,01', 1],
    ['45,', 4500],
  ])('%s → %i', (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it.each(['', '0', '0,00', '-5', 'abc', '1,2,3', '12,345', '1.23.4', '1,234.56', '12.345,6.7'])(
    'rejects %j',
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );

  it('formats and round-trips', () => {
    expect(formatEuro(123456).replace(/\s/g, ' ')).toBe('1.234,56 €');
    expect(centsToInput(123456)).toBe('1234,56');
    expect(parseAmount(centsToInput(4550))).toBe(4550);
  });
});

describe('date helpers', () => {
  it('formats local date without UTC shift (late evening)', () => {
    expect(formatDateLocal(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-31');
    expect(formatDateLocal(new Date(2026, 5, 1, 0, 5))).toBe('2026-06-01');
  });
  it('validates dates', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(isValidDate('26-1-1')).toBe(false);
  });
  it('month arithmetic and ranges', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(monthRange({ year: 2026, month: 2 })).toEqual(['2026-02-01', '2026-02-28']);
    expect(formatDateDE('2026-01-05')).toBe('05.01.2026');
  });
});

function entry(p: Partial<Entry>): Entry {
  return {
    id: crypto.randomUUID(),
    type: 'einnahme',
    date: '2026-01-10',
    title: 'x',
    amountCents: 100,
    categoryId: null,
    comment: '',
    attachments: [],
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
    deleted: false,
    ...p,
  };
}

const cats: Category[] = [
  { id: 'a', name: 'Behandlungen', type: 'einnahme', archived: false, sortOrder: 0, updatedAt: '', deleted: false },
  { id: 'b', name: 'Kurse', type: 'einnahme', archived: false, sortOrder: 1, updatedAt: '', deleted: false },
  { id: 'c', name: 'Material', type: 'ausgabe', archived: false, sortOrder: 0, updatedAt: '', deleted: false },
];

describe('sums', () => {
  const data = [
    entry({ amountCents: 4500, categoryId: 'b' }),
    entry({ amountCents: 4500, categoryId: 'a' }),
    entry({ amountCents: 1000, categoryId: 'a', date: '2026-02-01' }),
    entry({ type: 'ausgabe', amountCents: 2599, categoryId: 'c' }),
    entry({ type: 'ausgabe', amountCents: 100, categoryId: null, date: '2026-12-31' }),
  ];

  it('totals', () => {
    expect(totals(data)).toEqual({ income: 10000, expense: 2699, result: 7301 });
  });
  it('monthly totals', () => {
    const m = monthlyTotals(data, 2026);
    expect(m).toHaveLength(12);
    expect(m[0]).toEqual({ income: 9000, expense: 2599, result: 6401 });
    expect(m[1]).toEqual({ income: 1000, expense: 0, result: 1000 });
    expect(m[11]).toEqual({ income: 0, expense: 100, result: -100 });
  });
  it('category sums ordered by sortOrder, unknown last', () => {
    expect(categorySums(data, cats, 'einnahme')).toEqual([
      { categoryId: 'a', name: 'Behandlungen', sum: 5500 },
      { categoryId: 'b', name: 'Kurse', sum: 4500 },
    ]);
    expect(categorySums(data, cats, 'ausgabe').map((s) => [s.name, s.sum])).toEqual([
      ['Material', 2599],
      ['Ohne Kategorie', 100],
    ]);
  });
});
