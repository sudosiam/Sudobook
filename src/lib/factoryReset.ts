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

/** Delete all synced rows locally and push deletions to Dexie Cloud. */
async function wipeCloudData(): Promise<void> {
  if (!isCloudLoggedIn()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Go online to wipe cloud data. Your backup was already downloaded.');
  }

  const tables = CLOUD_SYNCED_STORES.map((name) => db.table(name));
  await db.transaction('rw', tables, async () => {
    for (const name of CLOUD_SYNCED_STORES) {
      await db.table(name).clear();
    }
  });
  await db.cloud.sync({ wait: true, purpose: 'push' });
  await db.cloud.sync({ wait: true, purpose: 'pull' });
}

export interface FactoryResetOptions {
  userId: string | null;
}

/**
 * Downloads a JSON backup, wipes cloud (when signed in + online), clears every
 * local Dexie store, removes form drafts, and re-seeds a fresh empty books.
 */
export async function factoryReset({ userId: _userId }: FactoryResetOptions): Promise<void> {
  stopSyncEngine();

  try {
    const backup = await exportBackup();
    downloadBackup(backup, 'sudo-books-factory-reset-backup');

    if (isDexieCloudConfigured && isCloudLoggedIn()) {
      await wipeCloudData();
    }

    await db.transaction('rw', db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
    });

    clearFormDrafts();
    await seedDatabase();
  } finally {
    startSyncEngine();
  }
}
