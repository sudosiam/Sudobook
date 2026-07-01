import { db, now, uuid, type SyncQueueItem } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const MAX_RETRIES = 3;

/**
 * Queue a record for background sync. Must be called INSIDE a Dexie
 * 'rw' transaction that already includes db.syncQueue.
 */
export async function enqueueSync(
  table: string,
  operation: SyncQueueItem['operation'],
  recordId: string,
  data: unknown,
): Promise<void> {
  const item: SyncQueueItem = {
    id: uuid(),
    table,
    operation,
    recordId,
    data,
    timestamp: now(),
    retryCount: 0,
    status: 'pending',
  };
  await db.syncQueue.add(item);
}

export async function pendingSyncCount(): Promise<number> {
  return db.syncQueue.where('status').anyOf('pending', 'failed').count();
}

let running = false;

/**
 * Drain the sync queue to Supabase. Safe no-op when Supabase is not
 * configured or the user is offline / unauthenticated.
 */
export async function processSyncQueue(): Promise<void> {
  if (running) return;
  if (!isSupabaseConfigured || !supabase) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return;

  running = true;
  try {
    // Recover items orphaned in 'syncing' by a previously interrupted run.
    const stuck = await db.syncQueue.where('status').equals('syncing').toArray();
    for (const s of stuck) await db.syncQueue.update(s.id, { status: 'pending' });

    // Process pending AND failed: failures during transient outages (network,
    // auth not ready, missing grants) must self-heal on later runs instead of
    // being stuck forever once retryCount hit the cap.
    const pending = await db.syncQueue
      .where('status')
      .anyOf('pending', 'failed')
      .sortBy('timestamp');
    let hadFailure = false;
    for (const item of pending) {
      try {
        await db.syncQueue.update(item.id, { status: 'syncing' });

        if (item.operation === 'delete') {
          // updated_at is set by the DB trigger; only mark the soft delete.
          const { error } = await supabase
            .from(item.table)
            .update({ deleted_at: now() })
            .eq('id', item.recordId);
          if (error) throw error;
        } else {
          // Uniform mirror: each row stores the full record as JSONB. This is
          // drift-proof across schema changes and keeps sync bulletproof.
          // Note: updated_at is intentionally NOT sent — the DB trigger stamps
          // it with the server clock so pull watermarks are consistent across
          // devices regardless of local clock skew.
          const payload = {
            id: item.recordId,
            user_id: userId,
            data: item.data,
          };
          const { error } = await supabase.from(item.table).upsert(payload);
          if (error) throw error;
        }

        await db.syncQueue.delete(item.id);
      } catch (err) {
        console.error('[processSyncQueue]', item.table, err);
        const retryCount = item.retryCount + 1;
        await db.syncQueue.update(item.id, {
          status: retryCount >= MAX_RETRIES ? 'failed' : 'pending',
          retryCount,
        });
        hadFailure = true;
      }
    }
    if (!hadFailure) {
      await db.settings.update('singleton', { lastSyncAt: now() });
    }
  } finally {
    running = false;
  }
}

/** Dexie store name ↔ Supabase table name. */
const SYNC_TABLES: { local: string; remote: string }[] = [
  { local: 'accounts', remote: 'accounts' },
  { local: 'journalEntries', remote: 'journal_entries' },
  { local: 'customers', remote: 'customers' },
  { local: 'vendors', remote: 'vendors' },
  { local: 'products', remote: 'products' },
  { local: 'sales', remote: 'sales' },
  { local: 'purchases', remote: 'purchases' },
  { local: 'expenses', remote: 'expenses' },
  { local: 'recurringExpenses', remote: 'recurring_expenses' },
  { local: 'bankAccounts', remote: 'bank_accounts' },
  { local: 'bankTransactions', remote: 'bank_transactions' },
  { local: 'stockMovements', remote: 'stock_movements' },
];

interface MirrorRow {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
}

let pulling = false;

/**
 * Pull rows changed since the last watermark from Supabase into Dexie.
 * Merges last-write-wins by `updatedAt`, applies soft deletes, and never
 * enqueues sync entries (so it cannot loop with the push queue).
 *
 * Local-first: this runs in the background and never blocks the UI (which
 * always reads from Dexie). A FULL download happens only when there is no
 * watermark yet — i.e. a brand-new device that has never pulled. After that,
 * every pull is incremental (delta only). The server-clock `updated_at`
 * trigger keeps the watermark reliable across devices.
 */
export async function pullFromSupabase(): Promise<void> {
  if (pulling) return;
  if (!isSupabaseConfigured || !supabase) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;

  pulling = true;
  try {
    const settings = await db.settings.get('singleton');
    const since = settings?.lastPullAt; // undefined only on a new device
    let watermark = since ?? '1970-01-01T00:00:00.000Z';
    let hadError = false;

    for (const { local, remote } of SYNC_TABLES) {
      let query = supabase
        .from(remote)
        .select('id, data, updated_at, deleted_at')
        .order('updated_at', { ascending: true });
      if (since) query = query.gt('updated_at', since);

      const { data, error } = await query;
      if (error) {
        console.error('[pullFromSupabase]', remote, error);
        hadError = true;
        continue;
      }

      const table = db.table(local);
      for (const row of (data ?? []) as MirrorRow[]) {
        try {
          if (row.deleted_at) {
            await table.delete(row.id);
          } else {
            const record = row.data as Record<string, unknown> & {
              updatedAt?: string;
              createdAt?: string;
            };
            const localRec = (await table.get(row.id)) as
              | { updatedAt?: string; createdAt?: string }
              | undefined;
            const localStamp = localRec?.updatedAt ?? localRec?.createdAt ?? '';
            const remoteStamp = record.updatedAt ?? record.createdAt ?? row.updated_at;

            if (!localRec || remoteStamp >= localStamp) {
              await table.put(record);
            }
          }
          // Only advance the watermark for rows we successfully applied.
          if (row.updated_at > watermark) watermark = row.updated_at;
        } catch (err) {
          console.error('[pullFromSupabase] apply', remote, row.id, err);
          hadError = true;
        }
      }
    }

    // Never advance the watermark past a failure, or we'd permanently skip the
    // rows we couldn't pull. Next run retries the same window (idempotent).
    if (!hadError) {
      await db.settings.update('singleton', { lastPullAt: watermark });
    }
  } finally {
    pulling = false;
  }
}

/**
 * Bump this whenever a change requires all devices to re-pull from scratch
 * (e.g. the server-clock updated_at migration). On mismatch we clear the pull
 * watermark so the next sync does a full backfill.
 */
const SYNC_RESET_TOKEN = '2026-07-01-server-clock';

export async function ensureSyncReset(): Promise<void> {
  const s = await db.settings.get('singleton');
  if (s && s.syncResetToken !== SYNC_RESET_TOKEN) {
    await db.settings.update('singleton', {
      lastPullAt: undefined,
      syncResetToken: SYNC_RESET_TOKEN,
    });
  }
}

/** Push local queue, then pull remote changes. */
export async function runSync(): Promise<void> {
  await processSyncQueue();
  await pullFromSupabase();
}

let intervalId: ReturnType<typeof setInterval> | null = null;

/** Start periodic + event-driven sync. Idempotent. */
export function startSyncEngine(): void {
  if (!isSupabaseConfigured) return;
  void runSync();
  if (intervalId === null) {
    intervalId = setInterval(() => void runSync(), 30_000);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => void runSync());
    // Sync-on-focus: catch up immediately when the user returns to the app
    // (e.g. switches back from another device) without waiting for the timer.
    window.addEventListener('focus', () => void runSync());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void runSync();
    });
  }
}

export function stopSyncEngine(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
