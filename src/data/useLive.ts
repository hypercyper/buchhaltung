// Reactive Dexie query hook (liveQuery from dexie core, no extra dependency).
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';

export function useLive<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: setValue,
      error: (e) => console.error(e),
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
