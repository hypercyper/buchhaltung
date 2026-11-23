import { useState } from 'react';
import {
  activeCategories,
  createCategory,
  deleteCategory,
  isCategoryUsed,
  moveItem,
  updateCategory,
} from '../../data/repo';
import type { Category, EntryType } from '../../data/types';
import { useLive } from '../../data/useLive';
import { confirmDialog } from '../../ui/confirm';
import { showToast } from '../../ui/toast';
import { SubPage } from './SubPage';

function CategoryRow({ category, list, index }: { category: Category; list: Category[]; index: number }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);

  async function rename() {
    if (name.trim() && name.trim() !== category.name) await updateCategory(category.id, { name: name.trim() });
    setEditing(false);
  }

  async function remove() {
    if (await isCategoryUsed(category.id)) {
      showToast('Diese Kategorie wird schon benutzt. Du kannst sie nur ausblenden.', undefined, 4500);
      return;
    }
    if (await confirmDialog(`Kategorie „${category.name}“ löschen?`, { okLabel: 'Löschen', danger: true })) {
      await deleteCategory(category.id);
    }
  }

  if (editing) {
    return (
      <li className="flex gap-2 py-2">
        <input className="field" value={name} autoFocus onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <button className="btn-small bg-teal-700 text-white" onClick={rename}>
          OK
        </button>
      </li>
    );
  }

  return (
    <li className={`flex items-center gap-1 py-1 ${category.archived ? 'text-gray-400' : ''}`}>
      <button className="min-h-11 flex-1 text-left" onClick={() => setEditing(true)} aria-label={`${category.name} umbenennen`}>
        {category.name}
        {category.archived && <span className="ml-2 text-sm">(ausgeblendet)</span>}
      </button>
      <button className="icon-btn text-lg" aria-label="Nach oben" disabled={index === 0} onClick={() => moveItem('categories', list, index, -1)}>
        ↑
      </button>
      <button className="icon-btn text-lg" aria-label="Nach unten" disabled={index === list.length - 1} onClick={() => moveItem('categories', list, index, 1)}>
        ↓
      </button>
      <button
        className="btn-small text-sm text-gray-700"
        onClick={() => updateCategory(category.id, { archived: !category.archived })}
      >
        {category.archived ? 'Einblenden' : 'Ausblenden'}
      </button>
      <button className="icon-btn text-lg text-red-700" aria-label={`${category.name} löschen`} onClick={remove}>
        🗑
      </button>
    </li>
  );
}

function CategorySection({ type, all }: { type: EntryType; all: Category[] }) {
  const [newName, setNewName] = useState('');
  const list = all.filter((c) => c.type === type);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await createCategory(type, newName);
    setNewName('');
  }

  return (
    <section className="card">
      <h2 className="mb-1 text-lg font-bold">{type === 'einnahme' ? 'Einnahmen' : 'Ausgaben'}</h2>
      <ul className="divide-y divide-gray-100">
        {list.map((c, i) => (
          <CategoryRow key={c.id} category={c} list={list} index={i} />
        ))}
      </ul>
      <form onSubmit={add} className="mt-2 flex gap-2">
        <input
          className="field"
          placeholder="Neue Kategorie"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="Neue Kategorie"
        />
        <button className="btn-small bg-teal-700 text-white" type="submit">
          Anlegen
        </button>
      </form>
    </section>
  );
}

export function CategoriesPage() {
  const all = useLive(activeCategories, [], []);
  return (
    <SubPage title="Kategorien">
      <p className="text-sm text-gray-600">
        Tippe auf einen Namen zum Umbenennen. Ausgeblendete Kategorien erscheinen nicht mehr bei neuen Buchungen, alte
        Buchungen behalten sie.
      </p>
      <CategorySection type="einnahme" all={all} />
      <CategorySection type="ausgabe" all={all} />
    </SubPage>
  );
}
