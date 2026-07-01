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
    if ((failed ?? 0) > 0) setStatus('error');
  }, [failed, setStatus]);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setStatus('syncing');
    try {
      await runSync({ manualRetry: true });
      const [pendingCount, failedCount] = await Promise.all([
        db.syncQueue.where('status').equals('pending').count(),
        db.syncQueue.where('status').equals('failed').count(),
      ]);
      setStatus(pendingCount + failedCount > 0 ? 'error' : 'idle');
    } catch {
      setStatus('error');
    }
  }, [setStatus]);

  return { pendingCount: (pending ?? 0) + (failed ?? 0), failedCount: failed ?? 0, syncNow, isSupabaseConfigured };
}
