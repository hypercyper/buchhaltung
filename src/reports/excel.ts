// Excel export for one year (PLAN.md §6.3): one sheet per month with real formulas,
// "Jahresübersicht" referencing the month sheets, "Alle Buchungen" as flat table with autofilter.
// Formulas are written in English syntax (SUM, SUMIFS); Excel shows them localized (SUMME …).
// Every formula also carries its computed result, so viewers without recalculation show correct numbers.
import ExcelJS from 'exceljs';
import type { Entry } from '../data/types';
import { MONTH_NAMES, parseDateLocal } from '../lib/date';
import { categoryName, categorySums, entriesOfMonth, monthlyTotals, sortByDate, totals } from '../lib/summary';
import { KU_NOTE, headerLines, type ReportInput } from './reportData';

const EURO_FORMAT = '#,##0.00 "€"';
const DATE_FORMAT = 'dd.mm.yyyy';
const ALL_SHEET = 'Alle Buchungen';
const THIN = { style: 'thin' as const, color: { argb: 'FF9CA3AF' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEAD_FILL = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD1E7E4' } };

/** Excel date that does not shift: UTC midnight of the local calendar date. */
function excelDate(date: string): Date {
  const { year, month, day } = parseDateLocal(date);
  return new Date(Date.UTC(year, month - 1, day));
}

const euros = (cents: number) => Math.round(cents) / 100;
const quoteSheet = (name: string) => `'${name.replace(/'/g, "''")}'`;
const quoteString = (s: string) => `"${s.replace(/"/g, '""')}"`;

interface MonthSheetRefs {
  name: string;
  incomeSum: string; // e.g. D12
  expenseSum: string;
  result: string;
}

function headerRow(sheet: ExcelJS.Worksheet, row: number, startCol: number, titles: string[]) {
  titles.forEach((t, i) => {
    const cell = sheet.getCell(row, startCol + i);
    cell.value = t;
    cell.font = { bold: true };
    cell.fill = HEAD_FILL;
    cell.border = BORDER;
  });
}

function monthSheet(wb: ExcelJS.Workbook, input: ReportInput, month: number): MonthSheetRefs {
  const name = `${MONTH_NAMES[month - 1]} ${input.year}`;
  const sheet = wb.addWorksheet(name);
  const entries = sortByDate(entriesOfMonth(input.entries, input.year, month));
  const incomes = entries.filter((e) => e.type === 'einnahme');
  const expenses = entries.filter((e) => e.type === 'ausgabe');

  sheet.columns = [
    { width: 12 }, { width: 24 }, { width: 18 }, { width: 13 }, { width: 24 },
    { width: 4 },
    { width: 12 }, { width: 24 }, { width: 18 }, { width: 13 }, { width: 24 },
  ];
  sheet.getCell('A1').value = name;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A3').value = 'Einnahmen';
  sheet.getCell('G3').value = 'Ausgaben';
  sheet.getCell('A3').font = sheet.getCell('G3').font = { bold: true, size: 12 };
  const titles = ['Datum', 'Bezeichnung', 'Kategorie', 'Betrag', 'Kommentar'];
  headerRow(sheet, 4, 1, titles);
  headerRow(sheet, 4, 7, titles);

  const first = 5;
  const rows = Math.max(incomes.length, expenses.length, 1);
  const last = first + rows - 1;

  const writeBlock = (list: Entry[], col: number) => {
    for (let i = 0; i < rows; i++) {
      const e = list[i];
      const values = e
        ? [excelDate(e.date), e.title, categoryName(input.categories, e.categoryId), euros(e.amountCents), e.comment]
        : [null, null, null, null, null];
      values.forEach((v, j) => {
        const cell = sheet.getCell(first + i, col + j);
        cell.value = v;
        cell.border = BORDER;
        if (j === 0) cell.numFmt = DATE_FORMAT;
        if (j === 3) cell.numFmt = EURO_FORMAT;
        if (j === 4) cell.alignment = { wrapText: true, vertical: 'top' };
      });
    }
  };
  writeBlock(incomes, 1);
  writeBlock(expenses, 7);

  const sumRow = last + 2;
  const resultRow = sumRow + 2;
  const t = totals(entries);
  const label = (ref: string, text: string) => {
    sheet.getCell(ref).value = text;
    sheet.getCell(ref).font = { bold: true };
  };
  const formula = (ref: string, f: string, resultCents: number) => {
    const cell = sheet.getCell(ref);
    cell.value = { formula: f, result: euros(resultCents) };
    cell.numFmt = EURO_FORMAT;
    cell.font = { bold: true };
    cell.border = { top: THIN, bottom: { style: 'double', color: { argb: 'FF374151' } } };
  };

  label(`C${sumRow}`, 'Summe');
  formula(`D${sumRow}`, `SUM(D${first}:D${last})`, t.income);
  label(`I${sumRow}`, 'Summe');
  formula(`J${sumRow}`, `SUM(J${first}:J${last})`, t.expense);
  label(`C${resultRow}`, 'Ergebnis');
  formula(`D${resultRow}`, `D${sumRow}-J${sumRow}`, t.result);

  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  return { name, incomeSum: `D${sumRow}`, expenseSum: `J${sumRow}`, result: `D${resultRow}` };
}

function allEntriesSheet(wb: ExcelJS.Workbook, input: ReportInput, entries: Entry[]): void {
  const sheet = wb.addWorksheet(ALL_SHEET);
  sheet.columns = [{ width: 12 }, { width: 11 }, { width: 26 }, { width: 20 }, { width: 13 }, { width: 32 }];
  headerRow(sheet, 1, 1, ['Datum', 'Typ', 'Bezeichnung', 'Kategorie', 'Betrag', 'Kommentar']);
  sortByDate(entries).forEach((e, i) => {
    const row = sheet.getRow(i + 2);
    row.values = [
      excelDate(e.date),
      e.type === 'einnahme' ? 'Einnahme' : 'Ausgabe',
      e.title,
      categoryName(input.categories, e.categoryId),
      euros(e.amountCents),
      e.comment,
    ];
    row.getCell(1).numFmt = DATE_FORMAT;
    row.getCell(5).numFmt = EURO_FORMAT;
  });
  sheet.autoFilter = { from: 'A1', to: { row: Math.max(1, entries.length + 1), column: 6 } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

function yearSheet(wb: ExcelJS.Workbook, input: ReportInput, entries: Entry[], months: MonthSheetRefs[]): void {
  const sheet = wb.addWorksheet('Jahresübersicht');
  sheet.columns = [{ width: 28 }, { width: 15 }, { width: 15 }, { width: 15 }];
  sheet.getCell('A1').value = `Jahresübersicht ${input.year}`;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  const header = headerLines(input.settings).join(', ');
  if (header) sheet.getCell('A2').value = header;
  if (input.settings.showKleinunternehmerNote) sheet.getCell('A3').value = KU_NOTE;

  headerRow(sheet, 5, 1, ['Monat', 'Einnahmen', 'Ausgaben', 'Ergebnis']);
  const monthly = monthlyTotals(entries, input.year);
  months.forEach((m, i) => {
    const r = 6 + i;
    const ref = quoteSheet(m.name);
    sheet.getCell(r, 1).value = MONTH_NAMES[i];
    sheet.getCell(r, 2).value = { formula: `${ref}!${m.incomeSum}`, result: euros(monthly[i].income) };
    sheet.getCell(r, 3).value = { formula: `${ref}!${m.expenseSum}`, result: euros(monthly[i].expense) };
    sheet.getCell(r, 4).value = { formula: `B${r}-C${r}`, result: euros(monthly[i].result) };
  });
  const sumRow = 18;
  const t = totals(entries);
  sheet.getCell(sumRow, 1).value = 'Summe';
  sheet.getCell(sumRow, 2).value = { formula: 'SUM(B6:B17)', result: euros(t.income) };
  sheet.getCell(sumRow, 3).value = { formula: 'SUM(C6:C17)', result: euros(t.expense) };
  sheet.getCell(sumRow, 4).value = { formula: 'B18-C18', result: euros(t.result) };
  for (let r = 6; r <= sumRow; r++) {
    for (let c = 1; c <= 4; c++) {
      const cell = sheet.getCell(r, c);
      cell.border = BORDER;
      if (c > 1) cell.numFmt = EURO_FORMAT;
      if (r === sumRow) cell.font = { bold: true };
    }
  }

  let row = sumRow + 3;
  const all = quoteSheet(ALL_SHEET);
  for (const type of ['einnahme', 'ausgabe'] as const) {
    const typeLabel = type === 'einnahme' ? 'Einnahme' : 'Ausgabe';
    headerRow(sheet, row, 1, [`${typeLabel}n nach Kategorie`, 'Summe']);
    row++;
    for (const s of categorySums(entries, input.categories, type)) {
      sheet.getCell(row, 1).value = s.name;
      sheet.getCell(row, 2).value = {
        formula: `SUMIFS(${all}!E:E,${all}!B:B,${quoteString(typeLabel)},${all}!D:D,${quoteString(s.name)})`,
        result: euros(s.sum),
      };
      sheet.getCell(row, 2).numFmt = EURO_FORMAT;
      sheet.getCell(row, 1).border = sheet.getCell(row, 2).border = BORDER;
      row++;
    }
    row += 2;
  }
}

export async function yearExcel(input: ReportInput): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Buchhaltung';
  wb.created = new Date();
  // Make Excel/LibreOffice recalculate on open (exceljs omits cached results of 0).
  wb.calcProperties.fullCalcOnLoad = true;
  const entries = input.entries.filter((e) => e.date.startsWith(`${input.year}-`));
  const months = Array.from({ length: 12 }, (_, i) => monthSheet(wb, input, i + 1));
  yearSheet(wb, input, entries, months);
  allEntriesSheet(wb, input, entries);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
