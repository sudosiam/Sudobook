import { db, now } from '@/lib/db';
import { enqueueSync } from '@/lib/sync';

const TABLES = [
  'accounts',
  'journalEntries',
  'customers',
  'vendors',
  'products',
  'productCategories',
  'sales',
  'purchases',
  'expenses',
  'recurringExpenses',
  'bankAccounts',
  'bankTransactions',
  'stockMovements',
  'settings',
] as const;

/** Dexie store name → Supabase table name for sync queue. */
const REMOTE_TABLE: Record<string, string> = {
  accounts: 'accounts',
  journalEntries: 'journal_entries',
  customers: 'customers',
  vendors: 'vendors',
  products: 'products',
  productCategories: 'product_categories',
  sales: 'sales',
  purchases: 'purchases',
  expenses: 'expenses',
  recurringExpenses: 'recurring_expenses',
  bankAccounts: 'bank_accounts',
  bankTransactions: 'bank_transactions',
  stockMovements: 'stock_movements',
};

export interface BackupFile {
  app: 'sudo-books';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown[]>;
}

export async function exportBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    data[t] = await db.table(t).toArray();
  }
  return { app: 'sudo-books', version: 1, exportedAt: new Date().toISOString(), data };
}

export function downloadBackup(backup: BackupFile, filenamePrefix = 'sudo-books-backup'): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  if (backup.app !== 'sudo-books') throw new Error('Not a Sudo Books backup file');
  const restoredAt = now();

  await db.transaction('rw', db.tables, async () => {
    for (const t of TABLES) {
      const rows = backup.data[t];
      if (!Array.isArray(rows)) continue;
      await db.table(t).clear();
      if (t === 'settings') {
        await db.table(t).bulkPut(rows);
        continue;
      }
      const stamped = rows.map((row) => {
        const r = row as Record<string, unknown> & { id?: string; createdAt?: string };
        return {
          ...r,
          updatedAt: restoredAt,
          createdAt: r.createdAt ?? restoredAt,
        };
      });
      await db.table(t).bulkPut(stamped);
    }

    await db.syncQueue.clear();

    // Queue every restored row for push so the cloud catches up to local.
    for (const [local, remote] of Object.entries(REMOTE_TABLE)) {
      const rows = backup.data[local];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        const r = row as { id: string };
        const stamped = {
          ...(row as Record<string, unknown>),
          updatedAt: restoredAt,
          createdAt: (row as { createdAt?: string }).createdAt ?? restoredAt,
        };
        await enqueueSync(remote, 'update', r.id, stamped);
      }
    }

    // Advance pull watermark so an immediate pull won't overwrite restored data.
    const settings = await db.settings.get('singleton');
    if (settings) {
      await db.settings.update('singleton', {
        lastPullAt: restoredAt,
        lastSyncAt: undefined,
      });
    }
  });
}
