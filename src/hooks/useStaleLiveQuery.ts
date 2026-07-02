import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

/**
 * Like useLiveQuery but keeps the last resolved value while a new query runs.
 * Avoids blank spinners/skeletons on filter changes, sync, and cache refresh.
 */
export function useStaleLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: unknown[],
): T | undefined {
  const staleRef = useRef<T | undefined>(undefined);
  const value = useLiveQuery(querier, deps);

  if (value !== undefined) {
    staleRef.current = value;
    return value;
  }

  return staleRef.current;
}
