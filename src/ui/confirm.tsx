import { useSyncExternalStore } from 'react';

interface ConfirmRequest {
  text: string;
  detail?: string;
  okLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

let current: ConfirmRequest | null = null;
const listeners = new Set<() => void>();

function set(request: ConfirmRequest | null) {
  current = request;
  listeners.forEach((l) => l());
}

/** Shows a modal question; resolves true on confirm. */
export function confirmDialog(text: string, options: { detail?: string; okLabel?: string; danger?: boolean } = {}) {
  return new Promise<boolean>((resolve) => {
    set({ text, detail: options.detail, okLabel: options.okLabel ?? 'Ja', danger: options.danger ?? false, resolve });
  });
}

export function ConfirmHost() {
  const request = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  if (!request) return null;

  const close = (ok: boolean) => {
    request.resolve(ok);
    set(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => close(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-semibold">{request.text}</p>
        {request.detail && <p className="mt-2 text-gray-700">{request.detail}</p>}
        <div className="mt-5 flex gap-3">
          <button className="btn flex-1 bg-gray-200" onClick={() => close(false)}>
            Abbrechen
          </button>
          <button
            className={`btn flex-1 text-white ${request.danger ? 'bg-red-700' : 'bg-teal-700'}`}
            onClick={() => close(true)}
            autoFocus
          >
            {request.okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
