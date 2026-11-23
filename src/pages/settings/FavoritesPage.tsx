import { useState } from 'react';
import {
  activeCategories,
  activeFavorites,
  createFavorite,
  deleteFavorite,
  moveItem,
  updateFavorite,
  type FavoriteInput,
} from '../../data/repo';
import type { EntryType, Favorite } from '../../data/types';
import { useLive } from '../../data/useLive';
import { centsToInput, formatEuro, parseAmount } from '../../lib/money';
import { confirmDialog } from '../../ui/confirm';
import { SubPage } from './SubPage';

function FavoriteForm({ initial, onDone }: { initial?: Favorite; onDone: () => void }) {
  const [type, setType] = useState<EntryType>(initial?.type ?? 'einnahme');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [amount, setAmount] = useState(initial?.amountCents ? centsToInput(initial.amountCents) : '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [error, setError] = useState('');
  const categories = useLive(activeCategories, [], []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const cents = amount.trim() ? parseAmount(amount) : null;
    if (!title.trim()) return setError('Bitte eine Bezeichnung eingeben.');
    if (amount.trim() && cents === null) return setError('Der Betrag ist ungültig, z. B. 45 oder 45,50.');
    const input: FavoriteInput = { type, title, amountCents: cents, categoryId: categoryId || null };
    if (initial) await updateFavorite(initial.id, input);
    else await createFavorite(input);
    onDone();
  }

  return (
    <form onSubmit={save} className="card flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(['einnahme', 'ausgabe'] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => {
              setType(t);
              setCategoryId('');
            }}
            className={`min-h-11 rounded-lg ${type === t ? 'bg-white font-semibold shadow' : 'text-gray-700'}`}
          >
            {t === 'einnahme' ? 'Einnahme' : 'Ausgabe'}
          </button>
        ))}
      </div>
      <div>
        <label className="label" htmlFor="fav-title">Bezeichnung</label>
        <input id="fav-title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="fav-amount">Betrag (leer lassen = jedes Mal eingeben)</label>
        <input id="fav-amount" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="fav-cat">Kategorie</label>
        <select id="fav-cat" className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">– ohne Kategorie –</option>
          {categories
            .filter((c) => c.type === type && (!c.archived || c.id === categoryId))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn flex-1 bg-gray-200" onClick={onDone}>
          Abbrechen
        </button>
        <button type="submit" className="btn flex-1 bg-teal-700 text-white">
          Speichern
        </button>
      </div>
    </form>
  );
}

export function FavoritesPage() {
  const favorites = useLive(activeFavorites, [], []);
  const [editing, setEditing] = useState<Favorite | 'new' | null>(null);

  async function remove(f: Favorite) {
    if (await confirmDialog(`Favorit „${f.title}“ löschen?`, { okLabel: 'Löschen', danger: true })) await deleteFavorite(f.id);
  }

  return (
    <SubPage title="Favoriten">
      <p className="text-sm text-gray-600">
        Favoriten erscheinen auf der Übersicht. Ein Tipp darauf füllt eine neue Buchung mit heutigem Datum aus.
      </p>
      {editing ? (
        <FavoriteForm initial={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
      ) : (
        <button className="btn bg-teal-700 text-white" onClick={() => setEditing('new')}>
          + Favorit hinzufügen
        </button>
      )}
      {favorites.length === 0 ? (
        <p className="text-gray-600">Noch keine Favoriten.</p>
      ) : (
        <ul className="card divide-y divide-gray-100 py-1">
          {favorites.map((f, i) => (
            <li key={f.id} className="flex items-center gap-1 py-1">
              <button className="min-h-11 flex-1 text-left" onClick={() => setEditing(f)} aria-label={`${f.title} bearbeiten`}>
                <span className={f.type === 'einnahme' ? 'text-emerald-800' : 'text-red-800'}>{f.type === 'einnahme' ? '+' : '−'}</span>{' '}
                {f.title}
                {f.amountCents !== null && <span className="text-gray-600"> · {formatEuro(f.amountCents)}</span>}
              </button>
              <button className="icon-btn text-lg" aria-label="Nach oben" disabled={i === 0} onClick={() => moveItem('favorites', favorites, i, -1)}>
                ↑
              </button>
              <button
                className="icon-btn text-lg"
                aria-label="Nach unten"
                disabled={i === favorites.length - 1}
                onClick={() => moveItem('favorites', favorites, i, 1)}
              >
                ↓
              </button>
              <button className="icon-btn text-lg text-red-700" aria-label={`${f.title} löschen`} onClick={() => remove(f)}>
                🗑
              </button>
            </li>
          ))}
        </ul>
      )}
    </SubPage>
  );
}
