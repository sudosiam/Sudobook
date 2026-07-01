import { db, now, uuid, type SyncQueueItem } from '@/lib/db';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  SYNC_TABLE_MAP,
  getSupabaseSchemaStatus,
  isMissingTableError,
  verifySupabaseSchema,
  type RemoteSyncTable,
} from '@/lib/supabaseSchema';
import { toast } from '@/store/useToast';
import { useSyncStore } from '@/store/useSyncStore';
import { postDueRecurringExpenses } from '@/lib/recurring';

export { getSupabaseSchemaStatus, verifySupabaseSchema };

const MAX_RETRIES = 3;
const SYNC_BATCH_SIZE = 100;
const PULL_PAGE_SIZE = 500;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const warnedFailedSync = new Set<string>();
const LOCAL_BY_REMOTE = new Map(SYNC_TABLE_MAP.map((t) => [t.remote, t.local]));

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

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string; code?: string };
  return e.status === 429 || e.code === '429' || /rate limit/i.test(e.message ?? '');
}

let authFailureNotified = false;

/** Refresh session and resolve user id; notify when sync is blocked by auth. */
async function resolveSyncUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    await supabase.auth.refreshSession();
  } catch (err) {
    console.warn('[resolveSyncUserId] refreshSession', err);
  }
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth.user) {
    const blocked = await db.syncQueue.where('status').anyOf('pending', 'failed').count();
    if (blocked > 0 && !authFailureNotified) {
      authFailureNotified = true;
      useSyncStore.getState().setStatus('error');
      toast.error('Cloud sync paused — sign in again in Settings to upload your data');
    }
    return null;
  }
  authFailureNotified = false;
  return auth.user.id;
}

/** Re-queue transient failed items so manual / periodic sync can retry them. */
export async function requeueFailedSyncItems(): Promise<number> {
  const failed = await db.syncQueue.where('status').equals('failed').toArray();
  if (failed.length === 0) return 0;

  let requeued = 0;
  await db.transaction('rw', db.syncQueue, async () => {
    for (const item of failed) {
      if (!UUID_RE.test(item.recordId)) continue;
      await db.syncQueue.update(item.id, { status: 'pending', retryCount: 0 });
      requeued += 1;
    }
  });
  return requeued;
}

/** Keep only the newest queue entry per table+recordId. */
async function coalesceSyncQueue(): Promise<void> {
  const items = await db.syncQueue
    .where('status')
    .anyOf('pending', 'failed', 'syncing')
    .toArray();
  if (items.length < 2) return;

  const latest = new Map<string, SyncQueueItem>();
  const staleIds: string[] = [];

  for (const item of items.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const key = `${item.table}:${item.recordId}`;
    const prev = latest.get(key);
    if (prev) staleIds.push(prev.id);
    latest.set(key, item);
  }

  if (staleIds.length === 0) return;
  await db.transaction('rw', db.syncQueue, async () => {
    for (const id of staleIds) await db.syncQueue.delete(id);
  });
}

async function freshQueuePayload(item: SyncQueueItem): Promise<unknown> {
  if (item.operation === 'delete') return item.data;
  const localTable = LOCAL_BY_REMOTE.get(item.table as RemoteSyncTable);
  if (!localTable) return item.data;
  const live = await db.table(localTable).get(item.recordId);
  return live ?? item.data;
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
  const existing = await db.syncQueue
    .where('status')
    .anyOf('pending', 'failed', 'syncing')
    .filter((row) => row.table === table && row.recordId === recordId)
    .first();

  if (existing) {
    await db.syncQueue.update(existing.id, {
      operation,
      data,
      timestamp: now(),
      status: 'pending',
      retryCount: 0,
    });
    return;
  }

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
    const userId = await resolveSyncUserId();
    if (!userId) return;

    await coalesceSyncQueue();

    let hadFailure = false;
    while (!hadFailure) {
      const pending = await db.syncQueue
        .where('status')
        .anyOf('pending', 'failed', 'syncing')
        .sortBy('timestamp');
      const batch = pending.slice(0, SYNC_BATCH_SIZE);
      if (batch.length === 0) break;

      for (const item of batch) {
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
            const payload = {
              id: item.recordId,
              user_id: userId,
              data: await freshQueuePayload(item),
            };
            const { error } = await supabase.from(item.table).upsert(payload);
            if (error) throw error;
          }

          await db.syncQueue.delete(item.id);
        } catch (err) {
          if (isRateLimitError(err)) {
            await db.syncQueue.update(item.id, { status: 'pending' });
            toast.info('Cloud sync slowed — will retry shortly');
            hadFailure = true;
            break;
          }
          if (isMissingTableError(err)) {
            warnMissingTableOnce(item.table);
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
    const userId = await resolveSyncUserId();
    if (!userId) return;

    const settings = await db.settings.get('singleton');
    const globalSince = settings?.lastPullAt;
    const pullByTable = { ...(settings?.lastPullAtByTable ?? {}) };
    let globalWatermark = globalSince ?? '1970-01-01T00:00:00.000Z';
    let settingsChanged = false;

    for (const { local, remote } of SYNC_TABLES) {
      if (missingRemoteTables.has(remote)) continue;

      const table = db.table(local);
      const since = pullByTable[remote] ?? globalSince;
      let tableWatermark = since ?? '1970-01-01T00:00:00.000Z';
      let tableOk = true;
      let page = 0;

      while (true) {
        let query = supabase
          .from(remote)
          .select('id, data, updated_at, deleted_at')
          .order('updated_at', { ascending: true });
        if (since) query = query.gte('updated_at', since);

        const from = page * PULL_PAGE_SIZE;
        const { data, error } = await query.range(from, from + PULL_PAGE_SIZE - 1);
        if (error) {
          tableOk = false;
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
                if (row.updated_at >= tableWatermark) tableWatermark = row.updated_at;
              }
            }
          } catch (err) {
            console.error('[pullFromSupabase] apply', remote, row.id, err);
          }
        }

        if (batch.length < PULL_PAGE_SIZE) break;
        page += 1;
      }

      const tableBaseline = since ?? '1970-01-01T00:00:00.000Z';
      if (tableOk && tableWatermark > tableBaseline) {
        pullByTable[remote] = tableWatermark;
        if (tableWatermark > globalWatermark) globalWatermark = tableWatermark;
        settingsChanged = true;
      }
    }

    if (settingsChanged) {
      await db.settings.update('singleton', {
        lastPullAt: globalWatermark,
        lastPullAtByTable: pullByTable,
      });
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
      lastPullAtByTable: undefined,
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
        const userId = await resolveSyncUserId();
        if (userId) await refreshSupabaseSchema();
      }
      await requeueFailedSyncItems();
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
