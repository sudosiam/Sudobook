import { downloadBackup, exportBackup } from '@/lib/backup';
import { db } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';

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
 * Downloads a safety backup, clears every local app table, removes form drafts,
 * and re-seeds a fresh empty books.
 */
export async function factoryReset(): Promise<void> {
  const backup = await exportBackup();
  downloadBackup(backup, 'sudo-books-factory-reset-backup');

  const appTables = db.tables;
  await db.transaction('rw', appTables, async () => {
    for (const table of appTables) {
      await table.clear();
    }
  });

  clearFormDrafts();
  await seedDatabase();
}
