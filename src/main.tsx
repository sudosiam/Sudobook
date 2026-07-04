import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import DataFolderSetup from '@/pages/setup/DataFolderSetup';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { PwaUpdateBanner } from '@/components/common/PwaUpdateBanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { postDueRecurringExpenses } from '@/lib/recurring';
import { startBackupScheduler } from '@/lib/scheduledBackup';
import { applyTheme, getStoredTheme } from '@/store/useThemeStore';
import { useDatabaseStore } from '@/store/useDatabaseStore';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-600.css';
import '@fontsource/roboto/latin-700.css';
import '@/styles/globals.css';

async function requestPersistentStorage(): Promise<void> {
  try {
    if (!navigator.storage?.persist) return;
    const already = await navigator.storage.persisted?.();
    if (already) return;
    await navigator.storage.persist();
  } catch (err) {
    console.warn('[requestPersistentStorage]', err);
  }
}

function Root() {
  const phase = useDatabaseStore((s) => s.phase);
  const checkExisting = useDatabaseStore((s) => s.checkExisting);

  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    void checkExisting();
  }, [checkExisting]);

  useEffect(() => {
    if (phase !== 'ready') return;
    void requestPersistentStorage();
    void postDueRecurringExpenses().catch((err) => {
      console.error('[postDueRecurringExpenses]', err);
    });
    startBackupScheduler();
  }, [phase]);

  if (phase === 'checking' || phase === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app">
        <LoadingSpinner />
      </div>
    );
  }

  if (phase === 'setup' || phase === 'error') {
    return <DataFolderSetup />;
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <PwaUpdateBanner />
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
