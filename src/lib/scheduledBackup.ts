import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import {
  downloadBackup,
  exportBackup,
  restoreBackup,
  saveBackupSnapshot,
  type BackupFile,
} from '@/lib/backup';
import { saveBackupToFolder } from '@/lib/backupFolder';
import { db, now, type AppSettings } from '@/lib/db';

export type AutoBackupInterval = 1 | 7 | 30;

export const AUTO_BACKUP_INTERVALS: { days: AutoBackupInterval; label: string }[] = [
  { days: 1, label: 'Daily' },
  { days: 7, label: 'Weekly' },
  { days: 30, label: 'Monthly' },
];

function isDue(lastRun: string | undefined, intervalDays: AutoBackupInterval): boolean {
  if (!lastRun) return true;
  try {
    return differenceInCalendarDays(new Date(), parseISO(lastRun)) >= intervalDays;
  } catch {
    return true;
  }
}

export interface RunBackupOptions {
  label: 'auto' | 'manual';
  download?: boolean;
  storeLocal?: boolean;
  saveToFolder?: boolean;
}

/** Export data, optionally download and/or store a rolling local snapshot. */
export async function runBackup(options: RunBackupOptions): Promise<BackupFile> {
  const backup = await exportBackup();
  const download = options.download ?? true;
  const storeLocal = options.storeLocal ?? true;
  const saveToFolder = options.saveToFolder ?? false;

  if (download) {
    const prefix =
      options.label === 'auto' ? 'sudo-books-auto-backup' : 'sudo-books-backup';
    downloadBackup(backup, prefix);
  }

  if (saveToFolder) {
    const prefix =
      options.label === 'auto' ? 'sudo-books-auto-backup' : 'sudo-books-backup';
    await saveBackupToFolder(backup, prefix);
  }

  if (storeLocal) {
    await saveBackupSnapshot(backup, options.label);
  }

  if (options.label === 'auto') {
    await db.settings.update('singleton', { lastAutoBackupAt: now() });
  }

  return backup;
}

/** Run an automatic backup when enabled and the interval has elapsed. */
export async function maybeRunScheduledBackup(): Promise<boolean> {
  const settings = await db.settings.get('singleton');
  if (!settings?.autoBackupEnabled) return false;

  const intervalDays = settings.autoBackupIntervalDays ?? 7;
  if (!isDue(settings.lastAutoBackupAt, intervalDays)) return false;

  try {
    await runBackup({
      label: 'auto',
      download: settings.autoBackupDownload !== false,
      storeLocal: settings.autoBackupStoreLocal !== false,
      saveToFolder: settings.autoBackupSaveToFolder === true,
    });
    return true;
  } catch (err) {
    console.error('[maybeRunScheduledBackup]', err);
    return false;
  }
}

let schedulerStarted = false;

/** Check on launch, when the tab becomes visible, and hourly while the app is open. */
export function startBackupScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  void maybeRunScheduledBackup();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void maybeRunScheduledBackup();
  });

  window.setInterval(() => {
    void maybeRunScheduledBackup();
  }, 60 * 60 * 1000);
}

export async function updateAutoBackupSettings(
  patch: Partial<
    Pick<
      AppSettings,
      | 'autoBackupEnabled'
      | 'autoBackupIntervalDays'
      | 'autoBackupDownload'
      | 'autoBackupStoreLocal'
      | 'autoBackupSaveToFolder'
    >
  >,
): Promise<void> {
  await db.settings.update('singleton', patch);
}

export function formatBackupTimestamp(iso: string | undefined): string {
  if (!iso) return 'Never';
  try {
    return format(parseISO(iso), 'd MMM yyyy, h:mm a');
  } catch {
    return iso;
  }
}

export async function restoreBackupSnapshot(snapshotId: string): Promise<void> {
  const snapshot = await db.backupSnapshots.get(snapshotId);
  if (!snapshot) throw new Error('Backup snapshot not found');
  await restoreBackup(snapshot.file as BackupFile);
}

export async function deleteBackupSnapshot(snapshotId: string): Promise<void> {
  await db.backupSnapshots.delete(snapshotId);
}

/** Manual backup that also records a local snapshot (same as Settings export + archive). */
export async function runManualBackupWithArchive(settings?: AppSettings | null): Promise<void> {
  const s = settings ?? (await db.settings.get('singleton'));
  await runBackup({
    label: 'manual',
    download: true,
    storeLocal: true,
    saveToFolder: s?.autoBackupSaveToFolder === true,
  });
}

export async function listBackupSnapshots() {
  return db.backupSnapshots.orderBy('createdAt').reverse().toArray();
}
