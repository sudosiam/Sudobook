import { downloadBackup, exportBackup } from '@/lib/backup';
import { db } from '@/lib/db';
import { seedDatabase } from '@/lib/seed';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { startSyncEngine, stopSyncEngine } from '@/lib/sync';

const DRAFT_PREFIX = 'sudobooks:draft:';

/** Supabase mirror tables — must match sync.ts. */
const REMOTE_TABLES = [
  'accounts',
  'journal_entries',
  'customers',
  'vendors',
  'products',
  'product_categories',
  'sales',
  'purchases',
  'expenses',
  'recurring_expenses',
  'bank_accounts',
  'bank_transactions',
  'stock_movements',
] as const;

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; status?: number; statusCode?: number };
  const message = e.message ?? '';
  return (
    e.code === 'PGRST205' ||
    e.status === 404 ||
    e.statusCode === 404 ||
    message.includes('Could not find the table') ||
    /relation .* does not exist/i.test(message)
  );
}

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

async function deleteCloudData(userId: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync not configured');

  for (const table of REMOTE_TABLES) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error && !isMissingTableError(error)) {
      throw new Error(`Could not wipe cloud data (${table}): ${error.message}`);
    }
  }
}

export interface FactoryResetOptions {
  /** When set, cloud rows for this user are hard-deleted before local wipe. */
  userId: string | null;
}

/**
 * Downloads a JSON backup, wipes cloud (when signed in + online), clears every
 * local Dexie store, removes form drafts, and re-seeds a fresh empty books.
 */
export async function factoryReset({ userId }: FactoryResetOptions): Promise<void> {
  stopSyncEngine();

  try {
    const backup = await exportBackup();
    downloadBackup(backup, 'sudo-books-factory-reset-backup');

    if (userId && isSupabaseConfigured) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Go online to wipe cloud data. Your backup was already downloaded.');
      }
      await deleteCloudData(userId);
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
