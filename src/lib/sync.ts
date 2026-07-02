import { db } from '@/lib/db';
import { configureDexieCloud, isDexieCloudConfigured } from '@/lib/cloud';
import { useSyncStore } from '@/store/useSyncStore';

let syncStateSub: { unsubscribe: () => void } | null = null;
let onlineHandler: (() => void) | null = null;

function applySyncState(): void {
  if (!isDexieCloudConfigured) return;
  const state = db.cloud.syncState.value;
  const syncing =
    state.phase === 'initial' ||
    state.phase === 'pushing' ||
    state.phase === 'pulling' ||
    state.phase === 'not-in-sync';

  if (!navigator.onLine || state.phase === 'offline') {
    useSyncStore.getState().setStatus('idle');
    return;
  }

  if (state.phase === 'error') {
    useSyncStore.getState().setStatus('error');
    return;
  }

  useSyncStore.getState().setStatus(syncing ? 'syncing' : 'idle');
}

/** Start Dexie Cloud sync observers. Idempotent. */
export function startSyncEngine(): void {
  configureDexieCloud();
  if (!isDexieCloudConfigured) return;

  if (!syncStateSub) {
    syncStateSub = db.cloud.syncState.subscribe(() => {
      applySyncState();
    });
    db.cloud.persistedSyncState.subscribe((persisted) => {
      if (persisted?.timestamp) {
        useSyncStore.getState().setLastSync(persisted.timestamp.toISOString());
      }
    });
  }

  if (typeof window !== 'undefined' && !onlineHandler) {
    onlineHandler = () => {
      useSyncStore.getState().setOnline(navigator.onLine);
      if (navigator.onLine) void syncNow();
    };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', onlineHandler);
    useSyncStore.getState().setOnline(navigator.onLine);
  }

  applySyncState();
}

/** Tear down sync listeners (factory reset, tests). */
export function stopSyncEngine(): void {
  syncStateSub?.unsubscribe();
  syncStateSub = null;
  if (onlineHandler && typeof window !== 'undefined') {
    window.removeEventListener('online', onlineHandler);
    window.removeEventListener('offline', onlineHandler);
    onlineHandler = null;
  }
}

/** Force a full sync cycle when online. */
export async function syncNow(): Promise<void> {
  if (!isDexieCloudConfigured) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  configureDexieCloud();
  useSyncStore.getState().setStatus('syncing');
  try {
    await db.cloud.sync({ wait: true, purpose: 'push' });
    await db.cloud.sync({ wait: true, purpose: 'pull' });
    applySyncState();
  } catch (err) {
    console.error('[syncNow]', err);
    useSyncStore.getState().setStatus('error');
    throw err;
  }
}

/** Manual retry alias used by Settings. */
export async function runSync(): Promise<void> {
  await syncNow();
}

/** Legacy hook — Dexie Cloud syncs writes automatically. */
export function scheduleSyncSoon(): void {
  /* no-op */
}

/** Legacy hook — Dexie Cloud syncs writes automatically. */
export function requestSync(): void {
  /* no-op */
}

/** @deprecated Dexie Cloud syncs automatically — kept for migration call sites. */
export async function enqueueSync(
  _table: string,
  _operation: 'create' | 'update' | 'delete',
  _recordId: string,
  _data?: unknown,
): Promise<void> {
  /* no-op */
}

/** Always zero — Dexie Cloud has no outbound queue table. */
export async function pendingSyncCount(): Promise<number> {
  if (!isDexieCloudConfigured || !navigator.onLine) return 0;
  const phase = db.cloud.syncState.value.phase;
  return phase === 'not-in-sync' || phase === 'pushing' ? 1 : 0;
}

/** @deprecated Removed with Supabase sync queue. */
export async function dismissFailedSyncItem(_id: string): Promise<void> {
  /* no-op */
}

/** @deprecated Removed with Supabase pull watermarks. */
export async function ensureSyncReset(): Promise<void> {
  /* no-op */
}
