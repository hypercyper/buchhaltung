import { useEffect, useSyncExternalStore } from 'react';

interface ToastData {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
  ms: number;
}

let current: ToastData | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function set(toast: ToastData | null) {
  current = toast;
  listeners.forEach((l) => l());
}

export function showToast(message: string, action?: ToastData['action'], ms = action ? 6000 : 2500): void {
  set({ id: nextId++, message, action, ms });
}

export function ToastHost() {
  const toast = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => set(null), toast.ms);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-gray-900 px-4 py-3 text-white shadow-lg"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          className="min-h-11 rounded-lg px-3 font-semibold text-teal-300"
          onClick={() => {
            // Clear first: the action may show a follow-up toast.
            set(null);
            toast.action!.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
