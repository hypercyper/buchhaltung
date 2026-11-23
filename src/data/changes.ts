// Tiny event hub: data writes notify the sync engine (debounced upload).
type Listener = () => void;
const listeners = new Set<Listener>();

let changeCounter = 0;

export function onLocalChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalChange(): void {
  changeCounter++;
  listeners.forEach((l) => l());
}

export function getChangeCounter(): number {
  return changeCounter;
}
