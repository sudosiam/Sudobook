import { useCallback, useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { isDexieCloudConfigured } from '@/lib/cloud';
import { syncNow } from '@/lib/sync';
import { useSyncStore } from '@/store/useSyncStore';

/** Reactive Dexie Cloud sync status + manual "Sync Now". */
export function useSync() {
  const setStatus = useSyncStore((s) => s.setStatus);
  const setLastSync = useSyncStore((s) => s.setLastSync);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isDexieCloudConfigured) return;

    const syncSub = db.cloud.syncState.subscribe((state) => {
      const pending =
        state.phase === 'not-in-sync' || state.phase === 'pushing' || state.phase === 'pulling';
      useSyncStore.getState().setPendingCount(pending ? 1 : 0);
      if (state.phase === 'error') setStatus('error');
      else if (pending) setStatus('syncing');
      else setStatus('idle');
    });

    const persistedSub = db.cloud.persistedSyncState.subscribe((persisted) => {
      if (persisted?.timestamp) setLastSync(persisted.timestamp.toISOString());
    });

    return () => {
      syncSub.unsubscribe();
      persistedSub.unsubscribe();
    };
  }, [setStatus, setLastSync]);

  const syncNowHandler = useCallback(async () => {
    if (!isDexieCloudConfigured || inFlight.current) return;
    inFlight.current = true;
    try {
      await syncNow();
    } catch {
      /* syncNow logs and sets store status */
    } finally {
      inFlight.current = false;
    }
  }, []);

  const phase = isDexieCloudConfigured ? db.cloud.syncState.value.phase : 'in-sync';
  const pendingCount = phase === 'not-in-sync' || phase === 'pushing' || phase === 'pulling' ? 1 : 0;
  const failedCount = isDexieCloudConfigured && phase === 'error' ? 1 : 0;

  return {
    pendingCount,
    failedCount,
    syncNow: syncNowHandler,
    isCloudConfigured: isDexieCloudConfigured,
  };
}
