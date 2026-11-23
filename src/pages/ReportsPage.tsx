import { useState } from 'react';
import { db } from '../data/db';
import { activeEntries, getSettings } from '../data/repo';
import { MONTH_NAMES, currentYearMonth, todayLocal } from '../lib/date';
import { NeedsTapError, PDF_MIME, XLSX_MIME, shareOrDownload } from '../lib/share';
import { fileName, type ReportInput } from '../reports/reportData';
import { showToast } from '../ui/toast';

type Mode = 'monat' | 'jahr';

interface ReadyFile {
  data: ArrayBuffer;
  name: string;
  mime: string;
}

async function loadInput(year: number): Promise<ReportInput> {
  const [entries, categories, settings] = await Promise.all([
    activeEntries(),
    db.categories.toArray(), // incl. deleted/archived: old entries keep their category names
    getSettings(),
  ]);
  return { entries: entries.filter((e) => e.date.startsWith(`${year}-`)), categories, settings, year, createdOn: todayLocal() };
}

export function ReportsPage() {
  const now = currentYearMonth();
  const [mode, setMode] = useState<Mode>('monat');
  const [year, setYear] = useState(now.year);
  const [month, setMonth] = useState(now.month);
  const [busy, setBusy] = useState<'pdf' | 'xlsx' | null>(null);
  const [ready, setReady] = useState<ReadyFile | null>(null);
  const years = Array.from({ length: 6 }, (_, i) => now.year - 4 + i);

  async function deliver(file: ReadyFile) {
    try {
      await shareOrDownload(file.data, file.name, file.mime);
      setReady(null);
    } catch (error) {
      if (error instanceof NeedsTapError) setReady(file);
      else throw error;
    }
  }

  async function run(kind: 'pdf' | 'xlsx') {
    setBusy(kind);
    setReady(null);
    try {
      const input = await loadInput(year);
      if (kind === 'pdf') {
        // Loaded on demand: keeps the app start fast.
        const { monthPdf, yearPdf } = await import('../reports/pdf');
        const data = mode === 'monat' ? monthPdf(input, month) : yearPdf(input);
        await deliver({ data, name: fileName(year, mode === 'monat' ? month : null, 'pdf'), mime: PDF_MIME });
      } else {
        const { yearExcel } = await import('../reports/excel');
        await deliver({ data: await yearExcel(input), name: fileName(year, null, 'xlsx'), mime: XLSX_MIME });
      }
    } catch (error) {
      console.error(error);
      showToast('Der Bericht konnte nicht erstellt werden. Bitte nochmal versuchen.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Berichte</h1>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="radiogroup" aria-label="Zeitraum">
        {(['monat', 'jahr'] as const).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-lg ${mode === m ? 'bg-white font-semibold shadow' : 'text-gray-700'}`}
          >
            {m === 'monat' ? 'Monat' : 'Jahr'}
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        {mode === 'monat' && (
          <div className="flex-1">
            <label className="label" htmlFor="r-month">Monat</label>
            <select id="r-month" className="field" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex-1">
          <label className="label" htmlFor="r-year">Jahr</label>
          <select id="r-year" className="field" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button className="btn min-h-14 bg-teal-700 text-white" disabled={!!busy} onClick={() => run('pdf')}>
        {busy === 'pdf' ? 'Wird erstellt …' : 'PDF erstellen'}
      </button>
      <button className="btn min-h-14 bg-gray-200" disabled={!!busy} onClick={() => run('xlsx')}>
        {busy === 'xlsx' ? 'Wird erstellt …' : `Excel erstellen (ganzes Jahr ${year})`}
      </button>
      {ready && (
        <button className="btn min-h-14 border-2 border-teal-700 bg-white text-teal-800" onClick={() => void deliver(ready)}>
          „{ready.name}“ ist fertig – jetzt teilen
        </button>
      )}
      <p className="text-sm text-gray-600">
        Die Datei kannst du danach teilen, z. B. per Mail an deinen Steuerberater, oder speichern.
      </p>
    </div>
  );
}
