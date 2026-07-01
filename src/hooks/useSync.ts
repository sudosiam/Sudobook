import { useCallback, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { runSync } from '@/lib/sync';
import { useSyncStore } from '@/store/useSyncStore';
import { isSupabaseConfigured } from '@/lib/supabase';

/** Reactive pending-count + a manual "Sync Now" trigger. */
export function useSync() {
  const setPendingCount = useSyncStore((s) => s.setPendingCount);
  const setStatus = useSyncStore((s) => s.setStatus);
  const inFlight = useRef(false);

  const pending = useLiveQuery(
    () => db.syncQueue.where('status').equals('pending').count(),
    [],
    0,
  );
  const failed = useLiveQuery(
    () => db.syncQueue.where('status').equals('failed').count(),
    [],
    0,
  );

  useEffect(() => {
    setPendingCount((pending ?? 0) + (failed ?? 0));
  }, [pending, failed, setPendingCount]);

  useEffect(() => {
    if (useSyncStore.getState().status === 'syncing') return;
    if ((failed ?? 0) > 0) setStatus('error');
    else if ((pending ?? 0) === 0 && (failed ?? 0) === 0) setStatus('idle');
  }, [pending, failed, setStatus]);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured || inFlight.current) return;
    inFlight.current = true;
    try {
      await runSync({ manualRetry: true });
    } catch {
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
  }, [setStatus]);

  return { pendingCount: (pending ?? 0) + (failed ?? 0), failedCount: failed ?? 0, syncNow, isSupabaseConfigured };
}
