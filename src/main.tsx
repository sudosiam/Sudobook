import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { DbOutdatedBanner } from '@/components/common/DbOutdatedBanner';
import { seedDatabase } from '@/lib/seed';
import { ensureSyncReset, startSyncEngine } from '@/lib/sync';
import { applyTheme, getStoredTheme } from '@/store/useThemeStore';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-600.css';
import '@fontsource/roboto/latin-700.css';
import '@/styles/globals.css';

/**
 * Ask the browser to exempt IndexedDB from "best-effort" storage eviction
 * under disk pressure. Best-effort: some browsers only grant this after
 * engagement heuristics (bookmarked/installed/frequently used) are met, but
 * it costs nothing to request and materially reduces silent data-loss risk
 * for a local-first accounting app. Never blocks or throws on failure.
 */
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

async function bootstrap() {
  applyTheme(getStoredTheme());
  void requestPersistentStorage();

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element not found');

  try {
    await seedDatabase();
    await ensureSyncReset();
    startSyncEngine();
  } catch (err) {
    // Non-fatal: still render the app so existing local data remains visible
    // even if a migration/seed/sync-boot step failed.
    console.error('[bootstrap]', err);
  }

  createRoot(rootEl).render(
    <StrictMode>
      <ErrorBoundary>
        <DbOutdatedBanner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap().catch((err) => {
  console.error('[bootstrap:fatal]', err);
});
