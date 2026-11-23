import { connectGoogle, syncNow, useSyncStatus } from '../sync/sync';
import { showToast } from './toast';

export function SyncBadge() {
  const { state, pending } = useSyncStatus();

  let text: string;
  let action: (() => void) | undefined;
  let tone = 'text-gray-600';

  if (state === 'auth') {
    text = 'Bitte erneut mit Google verbinden';
    tone = 'text-amber-800 underline';
    action = () =>
      connectGoogle()
        .then(() => syncNow())
        .catch(() => showToast('Verbindung mit Google hat nicht geklappt. Bitte nochmal versuchen.'));
  } else if (state === 'offline') {
    text = 'Offline – wird später gesichert';
  } else if (state === 'error') {
    text = 'Sicherung hat nicht geklappt – antippen zum Wiederholen';
    tone = 'text-amber-800 underline';
    action = () => void syncNow();
  } else if (state === 'syncing' || pending) {
    text = 'Wird gesichert …';
  } else if (state === 'ok') {
    text = 'Gesichert ✓';
    tone = 'text-emerald-700';
  } else {
    text = '';
  }

  if (!text) return null;
  return action ? (
    <button className={`min-h-11 text-sm ${tone}`} onClick={action}>
      {text}
    </button>
  ) : (
    <span className={`text-sm ${tone}`} aria-live="polite">
      {text}
    </span>
  );
}
