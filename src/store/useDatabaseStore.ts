import { create } from 'zustand';
import {
  getDataFolderRecord,
  hasDataFolder,
  readDatabaseFile,
  readJsonBackup,
  listJsonBackups,
  saveDataFolder,
} from '@/lib/dataFolder';
import { initDatabaseFromFolder, isDatabaseReady } from '@/lib/sqlite/engine';
import { seedDatabase } from '@/lib/seed';
import { restoreBackup, type BackupFile } from '@/lib/backup';

export type DatabasePhase = 'checking' | 'setup' | 'loading' | 'ready' | 'error';

interface DatabaseState {
  phase: DatabasePhase;
  error: string | null;
  folderName: string | null;
  checkExisting: () => Promise<void>;
  startFresh: (handle: FileSystemDirectoryHandle) => Promise<void>;
  openExisting: (handle: FileSystemDirectoryHandle) => Promise<void>;
  importJsonBackup: (handle: FileSystemDirectoryHandle, relativePath: string) => Promise<void>;
}

async function bootstrapAfterOpen(handle: FileSystemDirectoryHandle): Promise<void> {
  await saveDataFolder(handle);
  await initDatabaseFromFolder(handle);
  await seedDatabase();
}

export const useDatabaseStore = create<DatabaseState>((set) => ({
  phase: 'checking',
  error: null,
  folderName: null,

  checkExisting: async () => {
    set({ phase: 'checking', error: null });
    try {
      const configured = await hasDataFolder();
      if (!configured) {
        set({ phase: 'setup' });
        return;
      }
      const record = await getDataFolderRecord();
      if (!record) {
        set({ phase: 'setup' });
        return;
      }
      set({ phase: 'loading', folderName: record.folderName });
      await initDatabaseFromFolder(record.handle);
      await seedDatabase();
      set({ phase: 'ready', folderName: record.folderName });
    } catch (err) {
      console.error('[checkExisting]', err);
      set({
        phase: 'error',
        error: err instanceof Error ? err.message : 'Failed to open database folder',
      });
    }
  },

  startFresh: async (handle) => {
    set({ phase: 'loading', error: null });
    try {
      const existing = await readDatabaseFile(handle);
      if (existing) {
        throw new Error(
          'This folder already contains sudo-books.db. Use “Open existing database” or pick another folder.',
        );
      }
      await bootstrapAfterOpen(handle);
      set({ phase: 'ready', folderName: handle.name });
    } catch (err) {
      console.error('[startFresh]', err);
      set({
        phase: 'setup',
        error: err instanceof Error ? err.message : 'Could not create database',
      });
      throw err;
    }
  },

  openExisting: async (handle) => {
    set({ phase: 'loading', error: null });
    try {
      const bytes = await readDatabaseFile(handle);
      if (bytes) {
        await saveDataFolder(handle);
        await initDatabaseFromFolder(handle);
        await seedDatabase();
        set({ phase: 'ready', folderName: handle.name });
        return;
      }

      const backups = await listJsonBackups(handle);
      if (backups.length === 0) {
        throw new Error(
          'No sudo-books.db or JSON backup found in this folder. Start fresh or pick another folder.',
        );
      }

      const latest = backups[backups.length - 1]!;
      const raw = await readJsonBackup(handle, latest);
      const backup = JSON.parse(raw) as BackupFile;
      await saveDataFolder(handle);
      await initDatabaseFromFolder(handle);
      await restoreBackup(backup);
      await seedDatabase();
      set({ phase: 'ready', folderName: handle.name });
    } catch (err) {
      console.error('[openExisting]', err);
      set({
        phase: 'setup',
        error: err instanceof Error ? err.message : 'Could not open database',
      });
      throw err;
    }
  },

  importJsonBackup: async (handle, relativePath) => {
    set({ phase: 'loading', error: null });
    try {
      const raw = await readJsonBackup(handle, relativePath);
      const backup = JSON.parse(raw) as BackupFile;
      await saveDataFolder(handle);
      if (!isDatabaseReady()) {
        await initDatabaseFromFolder(handle);
      }
      await restoreBackup(backup);
      await seedDatabase();
      set({ phase: 'ready', folderName: handle.name });
    } catch (err) {
      console.error('[importJsonBackup]', err);
      set({
        phase: 'setup',
        error: err instanceof Error ? err.message : 'Import failed',
      });
      throw err;
    }
  },
}));

export function isAppDatabaseReady(): boolean {
  return useDatabaseStore.getState().phase === 'ready' && isDatabaseReady();
}
