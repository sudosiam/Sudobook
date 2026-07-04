import { useEffect, useState } from 'react';
import { subscribeDbChange } from '@/lib/sqlite/engine';

/**
 * Reactive query hook — re-runs when SQLite data changes (replacement for dexie-react-hooks).
 */
export function useLiveQuery<T>(
  queryFn: () => T | Promise<T>,
  deps: unknown[] = [],
  defaultResult?: T,
): T | undefined {
  const [value, setValue] = useState<T | undefined>(defaultResult);

  useEffect(() => {
    let cancelled = false;

    const run = () => {
      void Promise.resolve(queryFn()).then((result) => {
        if (!cancelled) setValue(result);
      });
    };

    run();
    const unsub = subscribeDbChange(run);
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps passed explicitly by caller
  }, deps);

  return value;
}
