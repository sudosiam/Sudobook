import { downloadBackup, exportBackup } from '@/lib/backup';
import { CLOUD_SYNCED_STORES, isDexieCloudConfigured, isCloudLoggedIn } from '@/lib/cloud';
import { db } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { startSyncEngine, stopSyncEngine } from '@/lib/sync';

const DRAFT_PREFIX = 'sudobooks:draft:';

function clearFormDrafts(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Push deletion of all synced app rows to Dexie Cloud so the cloud is also
 * wiped. Only called when online + authenticated.
 */
async function wipeCloudData(): Promise<void> {
  const tables = CLOUD_SYNCED_STORES.map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
    for (const name of CLOUD_SYNCED_STORES) {
      await db.table(name).clear();
    }
  });
  // Push the deletions, then confirm the pull returns empty.
  await db.cloud.sync({ wait: true, purpose: 'push' });
  await db.cloud.sync({ wait: true, purpose: 'pull' });
}

export interface FactoryResetOptions {
  userId: string | null;
}

/**
 * Downloads a safety backup, optionally wipes cloud data (when online +
 * signed in), clears every local app table, removes form drafts, and
 * re-seeds a fresh empty books.
 *
 * Fixes applied vs. old implementation:
 *
 * 1. Never throws on offline — if the device is offline the cloud wipe is
 *    skipped (with a console warning) so the local reset always completes.
 *
 * 2. Clears only user-defined app tables — Dexie Cloud adds $-prefixed
 *    internal tables ($logins, $realms, $members, $jobs, $roles, $globalIds)
 *    to db.tables. Clearing those destroys the auth session and sync state,
 *    so we filter them out using t.name.startsWith('$').
 *
 * 3. Signs out from Dexie Cloud before clearing local data so the background
 *    sync loop cannot immediately re-pull old cloud rows back into the fresh
 *    database during the reset window.
 */
export async function factoryReset({ userId: _userId }: FactoryResetOptions): Promise<void> {
  stopSyncEngine();

  try {
    // Step 1 — safety net: download a local backup BEFORE touching anything.
    const backup = await exportBackup();
    downloadBackup(backup, 'sudo-books-factory-reset-backup');

    // Step 2 — cloud wipe (best-effort, online + authenticated only).
    if (isDexieCloudConfigured && isCloudLoggedIn()) {
      const online = typeof navigator === 'undefined' || navigator.onLine;

      if (online) {
        // Push all deletions to the cloud so the other device also sees empty.
        await wipeCloudData();
      } else {
        // Offline: skip cloud wipe — warn, but do NOT abort the local reset.
        console.warn(
          '[factoryReset] Device is offline — cloud data NOT wiped. ' +
            'Sign in on another device to clear residual cloud data.',
        );
      }

      // Sign out regardless of whether the cloud was wiped. Without sign-out
      // the Dexie Cloud background sync would immediately pull the (possibly
      // still-populated) cloud data back into the freshly seeded local DB.
      await db.cloud.logout({ force: true }).catch((err) => {
        console.warn('[factoryReset] sign-out failed (non-fatal):', err);
      });
    }

    // Step 3 — wipe all local app tables.
    // db.tables includes Dexie Cloud's internal $-prefixed stores ($logins,
    // $realms, $members, $jobs, $roles, $globalIds). Clearing those corrupts
    // the Dexie Cloud addon state, so we explicitly exclude them.
    const appTables = db.tables.filter((t) => !t.name.startsWith('$'));
    await db.transaction('rw', appTables, async () => {
      for (const table of appTables) {
        await table.clear();
      }
    });

    // Step 4 — clear leftover form drafts from localStorage.
    clearFormDrafts();

    // Step 5 — re-seed a fresh, empty set of books.
    await seedDatabase();
  } finally {
    // Always restart the sync engine even if something above failed, so the
    // app stays functional (it may be in a partially-reset state).
    startSyncEngine();
  }
}
