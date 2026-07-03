import { db, now, uuid, type BackupSnapshot } from '@/lib/db';

const MAX_LOCAL_SNAPSHOTS = 5;

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

export interface BackupFile {
  app: 'sudo-books';
  version: 1 | 2;
  exportedAt: string;
  data: Record<string, unknown[]>;
  /** SHA-256 hex of JSON.stringify(data) — backup v2+. */
  checksum?: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function exportBackup(): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    data[t] = await db.table(t).toArray();
  }
  const payload = JSON.stringify(data);
  const checksum = await sha256Hex(payload);
  return {
    app: 'sudo-books',
    version: 2,
    exportedAt: new Date().toISOString(),
    data,
    checksum,
  };
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

/** Store a rolling archive of recent backups for quick restore on this device. */
export async function saveBackupSnapshot(
  file: BackupFile,
  label: BackupSnapshot['label'],
): Promise<string> {
  const id = uuid();
  const snapshot: BackupSnapshot = {
    id,
    createdAt: now(),
    label,
    file,
  };

  await db.transaction('rw', db.backupSnapshots, async () => {
    await db.backupSnapshots.add(snapshot);
    const excess = await db.backupSnapshots.orderBy('createdAt').reverse().offset(MAX_LOCAL_SNAPSHOTS).toArray();
    for (const row of excess) {
      await db.backupSnapshots.delete(row.id);
    }
  });

  return id;
}

export async function restoreBackup(backup: BackupFile): Promise<void> {
  if (backup.app !== 'sudo-books') throw new Error('Not a Sudo Books backup file');
  if (backup.checksum) {
    const actual = await sha256Hex(JSON.stringify(backup.data));
    if (actual !== backup.checksum) {
      throw new Error('Backup file is corrupted or was edited — checksum mismatch');
    }
  }
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

    await db.settings.update('singleton', {
      dashboardRevision: 0,
    });

    // Wipe stale cached metrics so the dashboard recomputes from restored data.
    await db.dashboardCache.clear();
  });
}
