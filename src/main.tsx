import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App';
import { seedDatabase } from '@/lib/seed';
import { ensureSyncReset, startSyncEngine } from '@/lib/sync';
import { applyTheme, getStoredTheme } from '@/store/useThemeStore';
import '@fontsource-variable/inter/index.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/600.css';
import '@fontsource/roboto/700.css';
import '@/styles/globals.css';

async function bootstrap() {
  applyTheme(getStoredTheme());
  await seedDatabase();
  await ensureSyncReset();
  startSyncEngine();

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element not found');

  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
