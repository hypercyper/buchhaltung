// Full-screen form for creating/editing an entry (PLAN.md §5.3).
import { useEffect, useRef, useState } from 'react';
import {
  activeCategories,
  activeFavorites,
  createCategory,
  createEntry,
  createFavorite,
  knownTitles,
  updateEntry,
} from '../data/repo';
import { useLive } from '../data/useLive';
import { centsToInput, formatEuro, parseAmount } from '../lib/money';
import { isValidDate, todayLocal } from '../lib/date';
import { showToast } from '../ui/toast';
import { closeEditor, type EditorRequest } from './editor';
import { deleteEntryWithUndo } from './deleteEntry';

const NEW_CATEGORY = '__new__';

export function EntryForm({ request }: { request: EditorRequest }) {
  const editing = request.mode === 'edit' ? request.entry : null;
  const type = editing ? editing.type : (request as Extract<EditorRequest, { mode: 'new' }>).type;
  const favorite = request.mode === 'new' ? request.favorite : undefined;
  const income = type === 'einnahme';

  const [date, setDate] = useState(editing?.date ?? todayLocal());
  const [title, setTitle] = useState(editing?.title ?? favorite?.title ?? '');
  const [amount, setAmount] = useState(() => {
    const cents = editing?.amountCents ?? favorite?.amountCents;
    return cents ? centsToInput(cents) : '';
  });
  const [categoryId, setCategoryId] = useState<string>(editing?.categoryId ?? favorite?.categoryId ?? '');
  const [comment, setComment] = useState(editing?.comment ?? '');
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const categories = useLive(activeCategories, [], []);
  const titles = useLive(() => knownTitles(type), [type], []);
  const choices = categories.filter((c) => c.type === type && (!c.archived || c.id === categoryId));

  // Favorite without fixed amount: jump straight to the amount field.
  useEffect(() => {
    if (favorite && favorite.amountCents === null) amountRef.current?.focus();
  }, [favorite]);

  // Android back button closes the form instead of leaving the screen.
  useEffect(() => {
    history.pushState({ editor: true }, '');
    const onPop = () => closeEditor();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const close = () => history.back();

  async function addCategory() {
    const name = newCategory?.trim();
    if (!name) return;
    const created = await createCategory(type, name);
    setCategoryId(created.id);
    setNewCategory(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cents = parseAmount(amount);
    const found: Record<string, string> = {};
    if (!isValidDate(date)) found.date = 'Bitte ein Datum wählen.';
    if (!title.trim()) found.title = 'Bitte eine Bezeichnung eingeben.';
    if (cents === null) found.amount = 'Bitte einen Betrag größer als 0 eingeben, z. B. 45 oder 45,50.';
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    const input = { type, date, title, amountCents: cents!, categoryId: categoryId || null, comment };
    if (editing) {
      await updateEntry(editing.id, input);
      showToast('Gespeichert');
    } else {
      await createEntry(input);
      const favorites = await activeFavorites();
      const known = favorites.some((f) => f.type === type && f.title.toLowerCase() === title.trim().toLowerCase());
      showToast(
        'Gespeichert',
        known
          ? undefined
          : {
              label: 'Als Favorit merken?',
              run: () => {
                void createFavorite({ type, title, amountCents: cents!, categoryId: categoryId || null });
                showToast(`Favorit „${title.trim()} ${formatEuro(cents!)}“ angelegt`);
              },
            },
      );
    }
    close();
  }

  async function remove() {
    if (editing && (await deleteEntryWithUndo(editing.id))) close();
  }

  const accent = income ? 'bg-emerald-700' : 'bg-red-700';

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <form onSubmit={save} className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-10" noValidate>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            {editing ? 'Buchung bearbeiten' : income ? 'Neue Einnahme' : 'Neue Ausgabe'}
          </h1>
          <button type="button" className="icon-btn" aria-label="Schließen" onClick={close}>
            ×
          </button>
        </div>

        <div>
          <label className="label" htmlFor="f-date">Datum</label>
          <input id="f-date" type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          {errors.date && <p className="mt-1 text-red-700">{errors.date}</p>}
        </div>

        <div>
          <label className="label" htmlFor="f-title">Bezeichnung</label>
          <input
            id="f-title"
            className="field"
            value={title}
            list="f-titles"
            autoComplete="off"
            placeholder={income ? 'z. B. Reiki' : 'z. B. Massageöl'}
            onChange={(e) => setTitle(e.target.value)}
          />
          <datalist id="f-titles">
            {titles.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          {errors.title && <p className="mt-1 text-red-700">{errors.title}</p>}
        </div>

        <div>
          <label className="label" htmlFor="f-amount">Betrag in Euro</label>
          <input
            id="f-amount"
            ref={amountRef}
            className="field text-xl"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {errors.amount && <p className="mt-1 text-red-700">{errors.amount}</p>}
        </div>

        <div>
          <label className="label" htmlFor="f-cat">Kategorie</label>
          {newCategory === null ? (
            <select
              id="f-cat"
              className="field"
              value={categoryId}
              onChange={(e) => (e.target.value === NEW_CATEGORY ? setNewCategory('') : setCategoryId(e.target.value))}
            >
              <option value="">– ohne Kategorie –</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Neue Kategorie</option>
            </select>
          ) : (
            <div className="flex gap-2">
              <input
                id="f-cat"
                className="field"
                placeholder="Name der neuen Kategorie"
                value={newCategory}
                autoFocus
                onChange={(e) => setNewCategory(e.target.value)}
              />
              <button type="button" className="btn-small bg-teal-700 text-white" onClick={addCategory}>
                Anlegen
              </button>
              <button type="button" className="btn-small bg-gray-200" onClick={() => setNewCategory(null)}>
                Zurück
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="f-comment">Kommentar (freiwillig)</label>
          <textarea id="f-comment" className="field" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>

        <button type="submit" className={`btn ${accent} mt-2 text-white`} disabled={saving}>
          Speichern
        </button>
        <button type="button" className="btn bg-gray-200" onClick={close}>
          Abbrechen
        </button>
        {editing && (
          <button type="button" className="btn border-2 border-red-700 bg-white text-red-700" onClick={remove}>
            Löschen
          </button>
        )}
      </form>
    </div>
  );
}
