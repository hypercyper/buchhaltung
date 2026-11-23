// Global "open the entry form" store, so any screen can open it.
import { useSyncExternalStore } from 'react';
import type { Entry, EntryType, Favorite } from '../data/types';

export type EditorRequest =
  | { mode: 'new'; type: EntryType; favorite?: Favorite }
  | { mode: 'edit'; entry: Entry };

let current: EditorRequest | null = null;
const listeners = new Set<() => void>();

function set(request: EditorRequest | null) {
  current = request;
  listeners.forEach((l) => l());
}

export const openNewEntry = (type: EntryType, favorite?: Favorite) => set({ mode: 'new', type, favorite });
export const openEditEntry = (entry: Entry) => set({ mode: 'edit', entry });
export const closeEditor = () => set(null);

export function useEditor(): EditorRequest | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
