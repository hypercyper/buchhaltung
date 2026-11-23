// PDF reports (PLAN.md §6.1, §6.2). A4 portrait, standard Helvetica (WinAnsi covers € and umlauts).
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Entry, EntryType } from '../data/types';
import { MONTH_NAMES, formatDateDE } from '../lib/date';
import { formatEuro } from '../lib/money';
import { categoryName, categorySums, entriesOfMonth, monthlyTotals, sortByDate, totals } from '../lib/summary';
import { KU_NOTE, headerLines, type ReportInput } from './reportData';

const MARGIN = 15;
const TEAL: [number, number, number] = [15, 118, 110];
const GREEN: [number, number, number] = [4, 120, 87];
const RED: [number, number, number] = [185, 28, 28];

// jsPDF standard fonts cannot render U+2212 or narrow no-break spaces.
const money = (cents: number) => formatEuro(cents).replace(/ /g, ' ');

function lastY(doc: jsPDF): number {
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function header(doc: jsPDF, input: ReportInput, title: string): number {
  let y = MARGIN + 2;
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(60);
  for (const line of headerLines(input.settings)) {
    doc.text(line, MARGIN, y);
    y += 5;
  }
  y += 4;
  doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(0);
  doc.text(title, MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90);
  doc.text(`Erstellt am ${formatDateDE(input.createdOn)}`, MARGIN, y);
  y += 5;
  if (input.settings.showKleinunternehmerNote) {
    doc.text(KU_NOTE, MARGIN, y);
    y += 5;
  }
  return y + 3;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  y = ensureSpace(doc, y, 20);
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(0);
  doc.text(text, MARGIN, y);
  return y + 2;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - MARGIN - 8) {
    doc.addPage();
    return MARGIN + 5;
  }
  return y;
}

const tableStyles = {
  theme: 'grid' as const,
  margin: { left: MARGIN, right: MARGIN, bottom: MARGIN + 8 },
  styles: { fontSize: 9, cellPadding: 1.8, overflow: 'linebreak' as const },
  headStyles: { fillColor: TEAL, textColor: 255 },
  footStyles: { fillColor: [235, 240, 239] as [number, number, number], textColor: 0, fontStyle: 'bold' as const },
};

function entryTable(doc: jsPDF, input: ReportInput, entries: Entry[], type: EntryType, y: number): number {
  const label = type === 'einnahme' ? 'Einnahmen' : 'Ausgaben';
  y = sectionTitle(doc, label, y);
  const rows = sortByDate(entries.filter((e) => e.type === type)).map((e) => [
    formatDateDE(e.date),
    e.title,
    categoryName(input.categories, e.categoryId),
    e.comment,
    money(e.amountCents),
  ]);
  const sum = entries.filter((e) => e.type === type).reduce((s, e) => s + e.amountCents, 0);
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [['Datum', 'Bezeichnung', 'Kategorie', 'Kommentar', 'Betrag']],
    body: rows.length ? rows : [[{ content: `Keine ${label} in diesem Zeitraum`, colSpan: 5 }]],
    foot: [[{ content: `Summe ${label}`, colSpan: 4 }, money(sum)]],
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 42 },
      2: { cellWidth: 34 },
      4: { halign: 'right', cellWidth: 26 },
    },
    didParseCell: (data) => {
      if (data.section === 'foot' && data.column.index === 4) data.cell.styles.halign = 'right';
    },
  });
  return lastY(doc) + 8;
}

/** Income and expense category sums side by side. */
function categoryTables(doc: jsPDF, input: ReportInput, entries: Entry[], y: number): number {
  // Both tables must fit on one page (side by side cannot break cleanly).
  const rows = Math.max(1, ...(['einnahme', 'ausgabe'] as const).map((t) => categorySums(entries, input.categories, t).length));
  y = ensureSpace(doc, y, 16 + (rows + 1) * 7.5);
  y = sectionTitle(doc, 'Summen je Kategorie', y);
  const pageWidth = doc.internal.pageSize.getWidth();
  const gap = 6;
  const half = (pageWidth - 2 * MARGIN - gap) / 2;
  const startPage = doc.getNumberOfPages();
  let bottom = y;
  (['einnahme', 'ausgabe'] as const).forEach((type, i) => {
    const sums = categorySums(entries, input.categories, type);
    doc.setPage(startPage);
    autoTable(doc, {
      ...tableStyles,
      startY: y,
      margin: { ...tableStyles.margin, left: MARGIN + i * (half + gap), right: pageWidth - MARGIN - (i + 1) * half - i * gap },
      head: [[type === 'einnahme' ? 'Einnahmen' : 'Ausgaben', 'Summe']],
      body: sums.length ? sums.map((s) => [s.name, money(s.sum)]) : [['–', money(0)]],
      columnStyles: { 1: { halign: 'right', cellWidth: 26 } },
      didParseCell: (data) => {
        if (data.section === 'head' && data.column.index === 1) data.cell.styles.halign = 'right';
      },
    });
    bottom = Math.max(bottom, lastY(doc));
  });
  doc.setPage(doc.getNumberOfPages());
  return bottom + 8;
}

function resultBox(doc: jsPDF, label: string, cents: number, y: number): number {
  y = ensureSpace(doc, y, 18);
  const width = doc.internal.pageSize.getWidth() - 2 * MARGIN;
  doc.setDrawColor(...TEAL).setLineWidth(0.6).setFillColor(240, 247, 246);
  doc.roundedRect(MARGIN, y, width, 12, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(0);
  doc.text(label, MARGIN + 4, y + 8);
  doc.setTextColor(...(cents >= 0 ? GREEN : RED));
  doc.text(money(cents), MARGIN + width - 4, y + 8, { align: 'right' });
  doc.setTextColor(0);
  return y + 20;
}

function pageNumbers(doc: jsPDF): void {
  const pages = doc.getNumberOfPages();
  const { width, height } = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(110);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.text(`Seite ${i} von ${pages}`, width - MARGIN, height - 8, { align: 'right' });
  }
}

function newDoc(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

export function monthPdf(input: ReportInput, month: number): ArrayBuffer {
  const doc = newDoc();
  const entries = entriesOfMonth(input.entries, input.year, month);
  let y = header(doc, input, `Einnahmen-Überschuss-Übersicht ${MONTH_NAMES[month - 1]} ${input.year}`);
  y = entryTable(doc, input, entries, 'einnahme', y);
  y = entryTable(doc, input, entries, 'ausgabe', y);
  y = categoryTables(doc, input, entries, y);
  const t = totals(entries);
  y = ensureSpace(doc, y, 24);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(0);
  doc.text(`Einnahmen ${money(t.income)}  –  Ausgaben ${money(t.expense)}`, MARGIN, y);
  resultBox(doc, 'Ergebnis (Einnahmen – Ausgaben)', t.result, y + 3);
  pageNumbers(doc);
  return doc.output('arraybuffer');
}

export function yearPdf(input: ReportInput): ArrayBuffer {
  const doc = newDoc();
  const entries = input.entries.filter((e) => e.date.startsWith(`${input.year}-`));
  let y = header(doc, input, `Jahresübersicht ${input.year}`);

  y = sectionTitle(doc, 'Monate', y);
  const months = monthlyTotals(entries, input.year);
  const t = totals(entries);
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [['Monat', 'Einnahmen', 'Ausgaben', 'Ergebnis']],
    body: months.map((m, i) => [MONTH_NAMES[i], money(m.income), money(m.expense), money(m.result)]),
    foot: [['Jahressumme', money(t.income), money(t.expense), money(t.result)]],
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.column.index > 0) data.cell.styles.halign = 'right';
    },
  });
  y = lastY(doc) + 8;
  y = resultBox(doc, `Ergebnis ${input.year}`, t.result, y);
  y = categoryTables(doc, input, entries, y);

  doc.addPage();
  y = sectionTitle(doc, 'Anhang: alle Buchungen', MARGIN + 5);
  const sorted = sortByDate(entries);
  autoTable(doc, {
    ...tableStyles,
    startY: y,
    head: [['Datum', 'Typ', 'Bezeichnung', 'Kategorie', 'Kommentar', 'Betrag']],
    body: sorted.map((e) => [
      formatDateDE(e.date),
      e.type === 'einnahme' ? 'Einnahme' : 'Ausgabe',
      e.title,
      categoryName(input.categories, e.categoryId),
      e.comment,
      money(e.amountCents),
    ]),
    columnStyles: { 0: { cellWidth: 21 }, 1: { cellWidth: 19 }, 5: { halign: 'right', cellWidth: 24 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const type = sorted[data.row.index]?.type;
        data.cell.styles.textColor = type === 'einnahme' ? GREEN : RED;
      }
    },
  });
  pageNumbers(doc);
  return doc.output('arraybuffer');
}
