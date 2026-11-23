import { setEntryDeleted } from '../data/repo';
import { confirmDialog } from '../ui/confirm';
import { showToast } from '../ui/toast';

/** Asks, deletes (tombstone) and offers undo for ~6 seconds. Returns true if deleted. */
export async function deleteEntryWithUndo(id: string): Promise<boolean> {
  const ok = await confirmDialog('Buchung wirklich löschen?', { okLabel: 'Löschen', danger: true });
  if (!ok) return false;
  await setEntryDeleted(id, true);
  showToast('Buchung gelöscht', { label: 'Rückgängig', run: () => void setEntryDeleted(id, false) });
  return true;
}
