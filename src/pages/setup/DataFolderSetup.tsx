import { useState } from 'react';
import { Database, FolderOpen, Sparkles } from 'lucide-react';
import { isDataFolderSupported } from '@/lib/dataFolder';
import { useDatabaseStore } from '@/store/useDatabaseStore';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export default function DataFolderSetup() {
  const { startFresh, openExisting, error, phase } = useDatabaseStore();
  const [busy, setBusy] = useState<'fresh' | 'open' | null>(null);
  const folderSupported = isDataFolderSupported();

  const pickFolder = async (): Promise<FileSystemDirectoryHandle | null> => {
    if (!folderSupported) return null;
    return window.showDirectoryPicker({ mode: 'readwrite', id: 'sudo-books-data' });
  };

  const handleStartFresh = async () => {
    try {
      setBusy('fresh');
      const handle = await pickFolder();
      if (!handle) return;
      await startFresh(handle);
    } catch (err) {
      console.error('[handleStartFresh]', err);
    } finally {
      setBusy(null);
    }
  };

  const handleOpenExisting = async () => {
    try {
      setBusy('open');
      const handle = await pickFolder();
      if (!handle) return;
      await openExisting(handle);
    } catch (err) {
      console.error('[handleOpenExisting]', err);
    } finally {
      setBusy(null);
    }
  };

  if (phase === 'loading' || busy) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app px-6">
        <LoadingSpinner />
        <p className="text-sm text-muted">Opening your books…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-app px-4 py-8 pb-safe">
      <div className="mx-auto w-full max-w-md flex-1 space-y-8">
        <header className="space-y-2 pt-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F3D91]/20">
            <Database className="h-7 w-7 text-[#3B82F6]" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Sudo Books</h1>
          <p className="text-sm text-muted">
            Your books are stored as a SQLite file in a folder you choose. No login, no cloud —
            you own the data.
          </p>
        </header>

        {!folderSupported ? (
          <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-4 text-sm text-[#F59E0B]">
            Folder selection requires Chrome or Edge on desktop/Android. Safari and Firefox do not
            support this yet — use Chrome or Edge to run Sudo Books.
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => void handleOpenExisting()}
              disabled={busy != null}
              className="flex min-h-[72px] w-full items-start gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-colors active:bg-surface-hover"
            >
              <FolderOpen className="mt-0.5 h-6 w-6 shrink-0 text-[#3B82F6]" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Open existing database</p>
                <p className="text-xs text-muted">
                  Pick the folder that already has <span className="font-mono">sudo-books.db</span>{' '}
                  or a JSON backup from this app.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => void handleStartFresh()}
              disabled={busy != null}
              className="flex min-h-[72px] w-full items-start gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-colors active:bg-surface-hover"
            >
              <Sparkles className="mt-0.5 h-6 w-6 shrink-0 text-[#22C55E]" />
              <div className="space-y-1">
                <p className="font-semibold text-foreground">Start fresh</p>
                <p className="text-xs text-muted">
                  Choose an empty folder — we will create{' '}
                  <span className="font-mono">sudo-books.db</span> there.
                </p>
              </div>
            </button>
          </div>
        )}

        {error ? (
          <p className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#EF4444]">
            {error}
          </p>
        ) : null}

        <p className="text-center text-xs text-muted">
          Keep your folder backed up (Google Drive, USB, etc.). Uninstalling the browser without a
          copy of the folder means losing your books.
        </p>
      </div>
    </div>
  );
}
