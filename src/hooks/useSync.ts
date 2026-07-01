import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { runSync } from '@/lib/sync';
import { useSyncStore } from '@/store/useSyncStore';
import { isSupabaseConfigured } from '@/lib/supabase';

/** Reactive pending-count + a manual "Sync Now" trigger. */
export function useSync() {
  const setPendingCount = useSyncStore((s) => s.setPendingCount);
  const setStatus = useSyncStore((s) => s.setStatus);

  const pending = useLiveQuery(
    () => db.syncQueue.where('status').anyOf('pending', 'failed').count(),
    [],
    0,
  );

  useEffect(() => {
    setPendingCount(pending ?? 0);
  }, [pending, setPendingCount]);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setStatus('syncing');
    try {
      await runSync();
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [setStatus]);

  return { pendingCount: pending ?? 0, syncNow, isSupabaseConfigured };
}
