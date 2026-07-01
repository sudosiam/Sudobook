import { db, now, uuid, type SyncQueueItem } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  SYNC_TABLE_MAP,
  getSupabaseSchemaStatus,
  isMissingTableError,
  verifySupabaseSchema,
} from '@/lib/supabaseSchema';
import { toast } from '@/store/useToast';
import { postDueRecurringExpenses } from '@/lib/recurring';

export { getSupabaseSchemaStatus, verifySupabaseSchema };

const MAX_RETRIES = 3;
const warnedFailedSync = new Set<string>();

const warnedMissingTables = new Set<string>();
/** Remote tables confirmed absent this session — skip pull/push to avoid 404 spam. */
const missingRemoteTables = new Set<string>();

function warnMissingTableOnce(table: string): void {
  if (warnedMissingTables.has(table)) return;
  warnedMissingTables.add(table);
  missingRemoteTables.add(table);
  console.warn(
    `[sync] Supabase table "${table}" is missing — apply supabase/migrations/006_recurring_expenses.sql and 007_product_categories.sql in your Supabase project. Local data is safe.`,
  );
  toast.info(
    `Cloud sync: "${table}" missing in Supabase — open Supabase Dashboard → SQL Editor and run supabase/migrations/RUN_ME_PENDING.sql`,
  );
}

/** Probe all mirror tables via supabase-js and refresh the skip-list. */
let schemaCheckedAt = 0;
const SCHEMA_CACHE_MS = 5 * 60 * 1000;

async function refreshSupabaseSchema(force = false): Promise<void> {
  if (!force && Date.now() - schemaCheckedAt < SCHEMA_CACHE_MS) return;
  const status = await verifySupabaseSchema();
  schemaCheckedAt = Date.now();
  const missingSet = new Set(status.missing);
  for (const { remote } of SYNC_TABLE_MAP) {
    if (missingSet.has(remote)) warnMissingTableOnce(remote);
    else missingRemoteTables.delete(remote);
  }
}

/** True when a local change is still waiting to push — pull must not overwrite it. */
async function hasPendingLocalSync(table: string, recordId: string): Promise<boolean> {
  const item = await db.syncQueue
    .where('status')
    .anyOf('pending', 'syncing', 'failed')
    .filter((row) => row.table === table && row.recordId === recordId)
    .first();
  return item !== undefined;
}

/** Postgres 22P02 — record id is not a valid uuid (e.g. legacy category slug). */
function isInvalidUuidSyncError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  return e.code === '22P02' && (e.message?.includes('uuid') ?? false);
}

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

/** Schedule a background sync after the current Dexie write transaction commits. */
export function requestSync(): void {
  scheduleSyncSoon();
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

  running = true;
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;

    // Recover items orphaned in 'syncing' by a previously interrupted run.
    const pending = await db.syncQueue
      .where('status')
      .anyOf('pending', 'failed', 'syncing')
      .sortBy('timestamp');
    let hadFailure = false;
    for (const item of pending) {
      if (item.status === 'syncing') {
        await db.syncQueue.update(item.id, { status: 'pending' });
      }
      if (missingRemoteTables.has(item.table)) continue;

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
        if (isMissingTableError(err)) {
          warnMissingTableOnce(item.table);
          // Keep queued — will sync once migrations are applied and the app reloads.
          await db.syncQueue.update(item.id, { status: 'pending' });
        } else if (isInvalidUuidSyncError(err)) {
          console.warn('[processSyncQueue] Permanent uuid error — leaving failed:', item.table, item.recordId);
          await db.syncQueue.update(item.id, { status: 'failed', retryCount: MAX_RETRIES });
          if (!warnedFailedSync.has(item.id)) {
            warnedFailedSync.add(item.id);
            toast.error(`Cloud sync blocked for ${item.table} — contact support or re-save the record`);
          }
          hadFailure = true;
        } else {
          console.error('[processSyncQueue]', item.table, err);
          const retryCount = item.retryCount + 1;
          const status = retryCount >= MAX_RETRIES ? 'failed' : 'pending';
          await db.syncQueue.update(item.id, {
            status,
            retryCount,
          });
          if (status === 'failed' && !warnedFailedSync.has(item.id)) {
            warnedFailedSync.add(item.id);
            toast.error(`Cloud sync failed for ${item.table} — tap Sync Now in Settings to retry`);
          }
          hadFailure = true;
        }
      }
    }
    if (!hadFailure) {
      await db.settings.update('singleton', { lastSyncAt: now() });
    }
  } finally {
    running = false;
  }
}

/** Dexie store name ↔ Supabase table name (canonical list in supabaseSchema.ts). */
const SYNC_TABLES = SYNC_TABLE_MAP;

interface MirrorRow {
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
  deleted_at: string | null;
}

/** Never let cloud sync revert a locally voided journal entry back to posted. */
function shouldApplyRemoteJournal(
  local: { status?: string; updatedAt?: string; createdAt?: string } | undefined,
  remote: { status?: string; updatedAt?: string; createdAt?: string },
  remoteUpdatedAt: string,
): boolean {
  if (!local) return true;
  if (local.status === 'void' && remote.status === 'posted') return false;
  const localStamp = local.updatedAt ?? local.createdAt ?? '';
  const remoteStamp = remote.updatedAt ?? remote.createdAt ?? remoteUpdatedAt;
  return remoteStamp >= localStamp;
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

  pulling = true;
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;

    const settings = await db.settings.get('singleton');
    const since = settings?.lastPullAt; // undefined only on a new device
    let watermark = since ?? '1970-01-01T00:00:00.000Z';

    for (const { local, remote } of SYNC_TABLES) {
      if (missingRemoteTables.has(remote)) continue;

      const table = db.table(local);
      const PULL_PAGE_SIZE = 500;
      let page = 0;

      while (true) {
        let query = supabase
          .from(remote)
          .select('id, data, updated_at, deleted_at')
          .order('updated_at', { ascending: true });
        if (since) query = query.gt('updated_at', since);

        const from = page * PULL_PAGE_SIZE;
        const { data, error } = await query.range(from, from + PULL_PAGE_SIZE - 1);
        if (error) {
          if (isMissingTableError(error)) {
            warnMissingTableOnce(remote);
          } else {
            console.error('[pullFromSupabase]', remote, error);
          }
          break;
        }

        const batch = (data ?? []) as MirrorRow[];
        for (const row of batch) {
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

            const isJournal = local === 'journalEntries';
            const applyJournal = isJournal
              ? shouldApplyRemoteJournal(
                  localRec as { status?: string; updatedAt?: string; createdAt?: string },
                  record as { status?: string; updatedAt?: string; createdAt?: string },
                  row.updated_at,
                )
              : true;

            const pendingLocal = localRec ? await hasPendingLocalSync(remote, row.id) : false;

            if (
              !pendingLocal &&
              (!localRec || remoteStamp >= localStamp) &&
              applyJournal
            ) {
              await table.put(record);
              if (row.updated_at > watermark) watermark = row.updated_at;
            }
          }
        } catch (err) {
          console.error('[pullFromSupabase] apply', remote, row.id, err);
        }
        }

        if (batch.length < PULL_PAGE_SIZE) break;
        page += 1;
      }
    }

    // Persist progress even on partial failure — applied rows are idempotent on re-pull.
    const baseline = since ?? '1970-01-01T00:00:00.000Z';
    if (watermark > baseline) {
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

let runSyncInFlight: Promise<void> | null = null;
let runSyncQueued = false;

/** Push local queue, then pull remote changes (single-flight with coalescing). */
export async function runSync(): Promise<void> {
  if (runSyncInFlight) {
    runSyncQueued = true;
    return runSyncInFlight;
  }

  runSyncInFlight = (async () => {
    do {
      runSyncQueued = false;
      if (supabase) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) await refreshSupabaseSchema();
      }
      await processSyncQueue();
      await pullFromSupabase();
      try {
        await postDueRecurringExpenses();
      } catch (err) {
        console.error('[postDueRecurringExpenses]', err);
      }
    } while (runSyncQueued);
  })();

  try {
    await runSyncInFlight;
  } finally {
    runSyncInFlight = null;
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;
let listenersAttached = false;
let syncSoonTimer: ReturnType<typeof setTimeout> | null = null;
let engineStarted = false;

function triggerSync(): void {
  void runSync().catch((err) => {
    console.error('[runSync]', err);
  });
}

/** Debounced sync after a local write — waits for the Dexie tx to commit. */
export function scheduleSyncSoon(delayMs = 2000): void {
  if (syncSoonTimer !== null) clearTimeout(syncSoonTimer);
  syncSoonTimer = setTimeout(() => {
    syncSoonTimer = null;
    triggerSync();
  }, delayMs);
}

function handleOnline(): void {
  triggerSync();
}

function handleFocus(): void {
  triggerSync();
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'visible') triggerSync();
}

/** Start periodic + event-driven sync. Idempotent. */
export function startSyncEngine(): void {
  if (!isSupabaseConfigured) return;
  if (!engineStarted) {
    engineStarted = true;
    triggerSync();
  }
  if (intervalId === null) {
    intervalId = setInterval(() => triggerSync(), 30_000);
  }
  if (typeof window !== 'undefined' && !listenersAttached) {
    window.addEventListener('online', handleOnline);
    // Sync-on-focus: catch up immediately when the user returns to the app
    // (e.g. switches back from another device) without waiting for the timer.
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    listenersAttached = true;
  }
}

export function stopSyncEngine(): void {
  engineStarted = false;
  if (syncSoonTimer !== null) {
    clearTimeout(syncSoonTimer);
    syncSoonTimer = null;
  }
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (typeof window !== 'undefined' && listenersAttached) {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    listenersAttached = false;
  }
}
