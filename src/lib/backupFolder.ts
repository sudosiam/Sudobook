import {
  getDataFolderRecord,
  writeJsonBackup,
  ensureWritePermission,
  isDataFolderSupported,
} from '@/lib/dataFolder';
import type { BackupFile } from '@/lib/backup';

/** True when automatic folder backups can write to the data folder. */
export function isBackupFolderSupported(): boolean {
  return isDataFolderSupported();
}

export async function getBackupFolderLabel(): Promise<string | null> {
  const row = await getDataFolderRecord();
  return row?.folderName ?? null;
}

/** Data folder is always the backup target when enabled in settings. */
export async function saveBackupToFolder(
  backup: BackupFile,
  filenamePrefix: string,
): Promise<string | null> {
  const row = await getDataFolderRecord();
  if (!row) return null;

  await ensureWritePermission(row.handle);
  const filename = `${filenamePrefix}-${backup.exportedAt.slice(0, 10)}.json`;
  const path = await writeJsonBackup(row.handle, filename, JSON.stringify(backup, null, 2));
  return path;
}

/** @deprecated Separate backup folder removed — data lives in the main folder. */
export async function pickBackupFolder(): Promise<string> {
  const label = await getBackupFolderLabel();
  if (!label) throw new Error('Choose a data folder first from the setup screen');
  return label;
}

/** @deprecated No-op — data folder is the only folder. */
export async function clearBackupFolder(): Promise<void> {
  /* no-op */
}
