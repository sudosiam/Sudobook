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
import {
  classifySyncError,
  isInvalidUuidSyncError,
  syncErrorMessage,
} from '@/lib/syncErrors';
import { isValidSyncRecordId } from '@/lib/syncIds';

export { getSupabaseSchemaStatus, verifySupabaseSchema };

const MAX_RETRIES = 3;
const SYNC_BATCH_SIZE = 100;
const PULL_PAGE_SIZE = 500;
/** Warn once when the outbound sync backlog may threaten IndexedDB quota. */
const SYNC_QUEUE_WARN_SIZE = 500;

const warnedFailedSync = new Set<string>();
const warnedQueueBacklog = { value: false };
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
    .anyOf('pending', 'syncing')
    .filter((row) => row.table === table && row.recordId === recordId)
    .first();
  return item !== undefined;
}

/** Minimal sanity check before writing pulled JSON into IndexedDB. */
function validatePulledRecord(rowId: string, data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (typeof record.id === 'string' && record.id !== rowId) return false;
  return true;
}

let authFailureNotified = false;

/** Refresh session and resolve user id; notify when sync is blocked by auth. */
async function resolveSyncUserId(): Promise<string | null> {
  if (!supabase) return null;

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return null;
  }

  const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
  if (refreshErr && refreshErr.name !== 'AuthSessionMissingError') {
    console.warn('[resolveSyncUserId] refreshSession', refreshErr);
  }
  if (refreshed.session) {
    authFailureNotified = false;
    return refreshed.session.user.id;
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

/**
 * Re-queue failed items for retry.
 * @param manual When true (Sync Now), retry all non-uuid failures. When false, skip permanent failures.
 */
export async function requeueFailedSyncItems(manual = false): Promise<number> {
  const failed = await db.syncQueue.where('status').equals('failed').toArray();
  if (failed.length === 0) return 0;

  let requeued = 0;
  await db.transaction('rw', db.syncQueue, async () => {
    for (const item of failed) {
      if (!isValidSyncRecordId(item.recordId)) continue;
      if (item.permanentFailure && !manual) continue;
      await db.syncQueue.update(item.id, {
        status: 'pending',
        retryCount: 0,
        permanentFailure: manual ? false : item.permanentFailure,
        lastError: undefined,
      });
      requeued += 1;
    }
  });
  return requeued;
}

/** Remove a permanently failed queue entry (data stays local only). */
export async function dismissFailedSyncItem(queueId: string): Promise<void> {
  await db.syncQueue.delete(queueId);
}

/** Keep only the newest queue entry per table+recordId. Deletes always win. */
async function coalesceSyncQueue(): Promise<void> {
  const items = await db.syncQueue
    .where('status')
    .anyOf('pending', 'failed', 'syncing')
    .toArray();
  if (items.length < 2) return;

  const grouped = new Map<string, SyncQueueItem[]>();
  for (const item of items) {
    const key = `${item.table}:${item.recordId}`;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  const staleIds: string[] = [];
  for (const group of grouped.values()) {
    group.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const hasDelete = group.some((item) => item.operation === 'delete');
    const deletes = group.filter((item) => item.operation === 'delete');
    const winner = hasDelete ? deletes[deletes.length - 1] : group[group.length - 1];
    for (const item of group) {
      if (item.id !== winner.id) staleIds.push(item.id);
    }
  }

  if (staleIds.length === 0) return;
  await db.transaction('rw', db.syncQueue, async () => {
    for (const id of staleIds) await db.syncQueue.delete(id);
  });
}

async function warnSyncQueueBacklog(): Promise<void> {
  if (warnedQueueBacklog.value) return;
  const count = await db.syncQueue
    .where('status')
    .anyOf('pending', 'failed', 'syncing')
    .count();
  if (count < SYNC_QUEUE_WARN_SIZE) return;
  warnedQueueBacklog.value = true;
  toast.info(
    `Large sync backlog (${count} items) — connect to the internet and tap Sync Now in Settings to avoid storage limits.`,
  );
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
  if (!isValidSyncRecordId(recordId)) {
    console.error('[enqueueSync] Invalid recordId — not queued for Supabase:', table, recordId);
    return;
  }
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
      permanentFailure: false,
      lastError: undefined,
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
    await warnSyncQueueBacklog();

    let hadFailure = false;
    while (!hadFailure) {
      const pending = await db.syncQueue
        .where('status')
        .anyOf('pending', 'failed', 'syncing')
        .sortBy('timestamp');
      const batch = pending.slice(0, SYNC_BATCH_SIZE);
      if (batch.length === 0) break;

      let madeProgress = false;
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
          madeProgress = true;
        } catch (err) {
          const message = syncErrorMessage(err);
          const kind = classifySyncError(err);

          if (kind === 'rate_limit') {
            await db.syncQueue.update(item.id, { status: 'pending', lastError: message });
            toast.info('Cloud sync slowed — will retry shortly');
            hadFailure = true;
            break;
          }

          if (kind === 'auth') {
            await db.syncQueue.update(item.id, {
              status: 'pending',
              lastError: message,
            });
            authFailureNotified = false;
            await resolveSyncUserId();
            hadFailure = true;
            break;
          }

          if (kind === 'missing_table') {
            warnMissingTableOnce(item.table);
            await db.syncQueue.update(item.id, { status: 'pending', lastError: message });
            hadFailure = true;
            break;
          }

          if (kind === 'permanent' || isInvalidUuidSyncError(err)) {
            console.warn('[processSyncQueue] Permanent failure:', item.table, item.recordId, message);
            await db.syncQueue.update(item.id, {
              status: 'failed',
              retryCount: MAX_RETRIES,
              permanentFailure: true,
              lastError: message,
            });
            if (!warnedFailedSync.has(item.id)) {
              warnedFailedSync.add(item.id);
              toast.error(`Cloud sync blocked for ${item.table} — see Settings → Cloud Sync`);
            }
            madeProgress = true;
            continue;
          }

          console.error('[processSyncQueue]', item.table, err);
          const retryCount = item.retryCount + 1;
          const status = retryCount >= MAX_RETRIES ? 'failed' : 'pending';
          await db.syncQueue.update(item.id, {
            status,
            retryCount,
            lastError: message,
            permanentFailure: status === 'failed' ? false : undefined,
          });
          if (status === 'failed' && !warnedFailedSync.has(item.id)) {
            warnedFailedSync.add(item.id);
            toast.error(`Cloud sync failed for ${item.table} — tap Sync Now in Settings to retry`);
          }
          hadFailure = true;
        }
      }

      // Avoid spinning forever when every item is skipped (missing table, etc.).
      if (!madeProgress) break;
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
  return remoteUpdatedAt >= localStamp;
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
      const tableBaseline = since ?? '1970-01-01T00:00:00.000Z';
      let maxAppliedAt = tableBaseline;
      let tableOk = true;
      let page = 0;

      while (true) {
        let query = supabase
          .from(remote)
          .select('id, data, updated_at, deleted_at')
          .order('updated_at', { ascending: true });
        // Incremental: only rows strictly newer than last watermark. First pull on
        // this device uses tableBaseline (1970) so all cloud rows download once.
        if (since) {
          query = query.gt('updated_at', since);
        } else {
          query = query.gte('updated_at', tableBaseline);
        }

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
              if (await hasPendingLocalSync(remote, row.id)) continue;
              await table.delete(row.id);
              if (row.updated_at >= maxAppliedAt) maxAppliedAt = row.updated_at;
              continue;
            }

            if (!validatePulledRecord(row.id, row.data)) {
              console.error('[pullFromSupabase] invalid data', remote, row.id);
              continue;
            }

            const record = row.data as Record<string, unknown> & {
              updatedAt?: string;
              createdAt?: string;
              status?: string;
            };
            const localRec = (await table.get(row.id)) as
              | { updatedAt?: string; createdAt?: string; status?: string }
              | undefined;
            const localStamp = localRec?.updatedAt ?? localRec?.createdAt ?? '';
            const remoteStamp = row.updated_at;

            const isJournal = local === 'journalEntries';
            const applyJournal = isJournal
              ? shouldApplyRemoteJournal(localRec, record, row.updated_at)
              : true;

            const pendingLocal = localRec ? await hasPendingLocalSync(remote, row.id) : false;

            if (!pendingLocal && (!localRec || remoteStamp >= localStamp) && applyJournal) {
              await table.put(record);
              if (row.updated_at >= maxAppliedAt) maxAppliedAt = row.updated_at;
            }
          } catch (err) {
            console.error('[pullFromSupabase] apply', remote, row.id, err);
          }
        }

        if (batch.length < PULL_PAGE_SIZE) break;
        page += 1;
      }

      // Advance watermark for successfully fetched rows even if some rows failed
      // to apply — otherwise a single bad row forces a full re-download every sync.
      if (tableOk && maxAppliedAt > tableBaseline) {
        pullByTable[remote] = maxAppliedAt;
        if (maxAppliedAt > globalWatermark) globalWatermark = maxAppliedAt;
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
/** True when a user-initiated sync should drive the dashboard badge state. */
let syncUiActive = false;

async function finishSyncUiStatus(): Promise<void> {
  const blocked = await pendingSyncCount();
  useSyncStore.getState().setStatus(blocked > 0 ? 'error' : 'idle');
}

/** Push local queue, then pull remote changes (single-flight with coalescing). */
export async function runSync(options?: { manualRetry?: boolean }): Promise<void> {
  if (runSyncInFlight) {
    if (options?.manualRetry) {
      syncUiActive = true;
      useSyncStore.getState().setStatus('syncing');
    }
    runSyncQueued = true;
    return runSyncInFlight;
  }

  syncUiActive = options?.manualRetry ?? false;
  if (syncUiActive) useSyncStore.getState().setStatus('syncing');

  const manualRetry = syncUiActive;

  runSyncInFlight = (async () => {
    do {
      runSyncQueued = false;
      if (supabase) {
        const userId = await resolveSyncUserId();
        if (userId) await refreshSupabaseSchema();
      }
      await requeueFailedSyncItems(manualRetry);
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
    if (syncUiActive) await finishSyncUiStatus();
    syncUiActive = false;
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
