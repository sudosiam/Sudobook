import { metaDb } from '@/lib/metaDb';

export const DB_FILENAME = 'sudo-books.db';
export const BACKUPS_DIR = 'backups';

const FOLDER_ID = 'singleton' as const;

/** True when the browser supports picking a writable folder (Chrome, Edge, some Android). */
export function isDataFolderSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getDataFolderRecord() {
  return metaDb.dataFolder.get(FOLDER_ID);
}

export async function getDataFolderName(): Promise<string | null> {
  const row = await getDataFolderRecord();
  return row?.folderName ?? null;
}

export async function hasDataFolder(): Promise<boolean> {
  const row = await getDataFolderRecord();
  return row != null;
}

export async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<void> {
  const current = await handle.queryPermission({ mode: 'readwrite' });
  if (current === 'granted') return;
  const requested = await handle.requestPermission({ mode: 'readwrite' });
  if (requested !== 'granted') {
    throw new Error('Write permission to the folder was denied');
  }
}

/** Persist folder handle after user picks a location. */
export async function saveDataFolder(handle: FileSystemDirectoryHandle): Promise<string> {
  await ensureWritePermission(handle);
  await metaDb.dataFolder.put({
    id: FOLDER_ID,
    folderName: handle.name,
    handle,
  });
  return handle.name;
}

export async function clearDataFolder(): Promise<void> {
  await metaDb.dataFolder.delete(FOLDER_ID);
}

/** Read `sudo-books.db` bytes from the folder, or null when starting fresh. */
export async function readDatabaseFile(
  handle: FileSystemDirectoryHandle,
): Promise<Uint8Array | null> {
  await ensureWritePermission(handle);
  try {
    const fileHandle = await handle.getFileHandle(DB_FILENAME);
    const file = await fileHandle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

/** Atomically write the SQLite file (replace existing). */
export async function writeDatabaseFile(
  handle: FileSystemDirectoryHandle,
  bytes: Uint8Array,
): Promise<void> {
  await ensureWritePermission(handle);
  const fileHandle = await handle.getFileHandle(DB_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(bytes as BufferSource);
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => undefined);
    throw err;
  }
}

/** List JSON backup files in the folder (root + backups/). */
export async function listJsonBackups(handle: FileSystemDirectoryHandle): Promise<string[]> {
  await ensureWritePermission(handle);
  const names: string[] = [];

  async function scan(dir: FileSystemDirectoryHandle) {
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json') && entry.name.includes('sudo-books')) {
        names.push(entry.name);
      }
      if (entry.kind === 'directory' && entry.name === BACKUPS_DIR) {
        const sub = await dir.getDirectoryHandle(entry.name);
        for await (const subEntry of sub.values()) {
          if (subEntry.kind === 'file' && subEntry.name.endsWith('.json')) {
            names.push(`${BACKUPS_DIR}/${subEntry.name}`);
          }
        }
      }
    }
  }

  await scan(handle);
  return names.sort();
}

/** Read a JSON backup file from the data folder. */
export async function readJsonBackup(
  handle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<string> {
  await ensureWritePermission(handle);
  const parts = relativePath.split('/');
  let dir = handle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]!);
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]!);
  const file = await fileHandle.getFile();
  return file.text();
}

/** Write a JSON backup into `backups/` inside the data folder. */
export async function writeJsonBackup(
  handle: FileSystemDirectoryHandle,
  filename: string,
  content: string,
): Promise<string> {
  await ensureWritePermission(handle);
  const backups = await handle.getDirectoryHandle(BACKUPS_DIR, { create: true });
  const fileHandle = await backups.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
    await writable.close();
  } catch (err) {
    await writable.abort().catch(() => undefined);
    throw err;
  }
  return `${BACKUPS_DIR}/${filename}`;
}
