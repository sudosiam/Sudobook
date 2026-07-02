import { db, type BackupFolderRecord } from '@/lib/db';
import type { BackupFile } from '@/lib/backup';

const FOLDER_ID = 'singleton' as const;

/** True when the browser supports picking a writable folder (Chrome, Edge, some Android). */
export function isBackupFolderSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getBackupFolderRecord(): Promise<BackupFolderRecord | undefined> {
  return db.backupFolder.get(FOLDER_ID);
}

export async function getBackupFolderLabel(): Promise<string | null> {
  const row = await getBackupFolderRecord();
  return row?.folderName ?? null;
}

/** Let the user pick a folder; persists handle in IndexedDB for scheduled backups. */
export async function pickBackupFolder(): Promise<string> {
  if (!isBackupFolderSupported()) {
    throw new Error('Folder selection is not supported in this browser');
  }

  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  const perm = await handle.requestPermission({ mode: 'readwrite' });
  if (perm !== 'granted') {
    throw new Error('Write permission to the folder was denied');
  }

  await db.backupFolder.put({
    id: FOLDER_ID,
    folderName: handle.name,
    handle,
  });

  return handle.name;
}

export async function clearBackupFolder(): Promise<void> {
  await db.backupFolder.delete(FOLDER_ID);
}

async function ensureFolderWritePermission(handle: FileSystemDirectoryHandle): Promise<void> {
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return;
  const requested = await handle.requestPermission({ mode: 'readwrite' });
  if (requested !== 'granted') {
    throw new Error('Cannot write to backup folder — open Settings and choose the folder again');
  }
}

/** Write a JSON backup file into the user-selected folder. No-op when no folder is set. */
export async function saveBackupToFolder(
  backup: BackupFile,
  filenamePrefix: string,
): Promise<string | null> {
  const row = await getBackupFolderRecord();
  if (!row) return null;

  await ensureFolderWritePermission(row.handle);

  const filename = `${filenamePrefix}-${backup.exportedAt.slice(0, 10)}.json`;
  const fileHandle = await row.handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(JSON.stringify(backup, null, 2));
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => undefined);
    throw err;
  }

  return filename;
}
