import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { START_CATEGORIES } from '../data/seed';
import { DEFAULT_SETTINGS, type Entry } from '../data/types';
import { monthlyTotals, totals } from '../lib/summary';
import { monthPdf, yearPdf } from './pdf';
import { yearExcel } from './excel';
import type { ReportInput } from './reportData';

// Deterministic sample year.
function sampleEntries(year: number): Entry[] {
  const out: Entry[] = [];
  let seed = 7;
  const rand = (n: number) => {
    seed = (seed * 16807) % 2147483647;
    return seed % n;
  };
  for (let month = 1; month <= 12; month++) {
    const count = month === 8 ? 0 : 3 + rand(12); // August stays empty
    for (let i = 0; i < count; i++) {
      const income = rand(3) > 0;
      const day = String(1 + rand(28)).padStart(2, '0');
      const date = `${year}-${String(month).padStart(2, '0')}-${day}`;
      const cats = START_CATEGORIES.filter((c) => c.type === (income ? 'einnahme' : 'ausgabe'));
      out.push({
        id: `e${month}-${i}`,
        type: income ? 'einnahme' : 'ausgabe',
        date,
        title: income ? ['Reiki', 'Reiki 60 Min', 'Workshop Achtsamkeit', 'Gutschein'][rand(4)] : ['Massageöl', 'Raummiete', 'Flyer', 'Fahrt Seminar'][rand(4)],
        amountCents: income ? 4500 + rand(8000) : 199 + rand(15000),
        categoryId: rand(10) === 0 ? null : cats[rand(cats.length)].id,
        comment: rand(4) === 0 ? 'Bar bezahlt, Quittung im Ordner – mit einem etwas längeren Kommentar' : '',
        attachments: [],
        createdAt: `${date}T10:00:00.000Z`,
        updatedAt: `${date}T10:00:00.000Z`,
        deleted: false,
      });
    }
  }
  return out;
}

const YEAR = 2026;
const input: ReportInput = {
  entries: sampleEntries(YEAR),
  categories: START_CATEGORIES,
  settings: {
    ...DEFAULT_SETTINGS,
    ownerName: 'Nadine Muster',
    businessName: 'Reiki & Energiearbeit',
    address: 'Hauptstraße 1\n78652 Deißlingen',
  },
  year: YEAR,
  createdOn: '2026-11-23',
};

async function save(name: string, data: ArrayBuffer) {
  const dir = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.REPORT_OUT;
  if (!dir) return;
  const fs = await import('node:fs');
  fs.writeFileSync(`${dir}/${name}`, new Uint8Array(data));
}

describe('reports', () => {
  it('month PDF is a valid PDF', async () => {
    const pdf = monthPdf(input, 3);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    await save('Buchhaltung_2026-03.pdf', pdf);
    await save('Buchhaltung_2026-08.pdf', monthPdf(input, 8));
  });

  it('year PDF is a valid PDF', async () => {
    const pdf = yearPdf(input);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    await save('Buchhaltung_2026.pdf', pdf);
  });

  it('Excel: sheets, formulas and cached results match app sums', async () => {
    const buffer = await yearExcel(input);
    await save('Buchhaltung_2026.xlsx', buffer);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((s) => s.name)).toEqual([
      'Januar 2026', 'Februar 2026', 'März 2026', 'April 2026', 'Mai 2026', 'Juni 2026',
      'Juli 2026', 'August 2026', 'September 2026', 'Oktober 2026', 'November 2026', 'Dezember 2026',
      'Jahresübersicht', 'Alle Buchungen',
    ]);

    const monthly = monthlyTotals(input.entries, YEAR);
    const overview = wb.getWorksheet('Jahresübersicht')!;
    for (let i = 0; i < 12; i++) {
      const cell = overview.getCell(6 + i, 2).value as { formula: string; result: number };
      expect(cell.formula).toMatch(/^'.+ 2026'!D\d+$/);
      expect(Math.round((cell.result ?? 0) * 100)).toBe(monthly[i].income);
    }
    const t = totals(input.entries);
    const sum = overview.getCell('D18').value as { formula: string; result: number };
    expect(sum.formula).toBe('B18-C18');
    expect(Math.round(sum.result * 100)).toBe(t.result);

    // Month sheet formula references the real data range.
    const march = wb.getWorksheet('März 2026')!;
    const refs = [] as string[];
    march.eachRow((row) => row.eachCell((c) => {
      const v = c.value as { formula?: string };
      if (v && typeof v === 'object' && v.formula) refs.push(`${c.address}=${v.formula}`);
    }));
    expect(refs.some((r) => /^D\d+=SUM\(D5:D\d+\)$/.test(r))).toBe(true);

    // Dates are real dates (no UTC shift).
    const all = wb.getWorksheet('Alle Buchungen')!;
    const firstDate = all.getCell('A2').value as Date;
    const firstEntry = [...input.entries].sort((a, b) => a.date.localeCompare(b.date))[0];
    expect(firstDate.toISOString().slice(0, 10)).toBe(firstEntry.date);
    expect(all.rowCount).toBe(input.entries.length + 1);
  });
});
