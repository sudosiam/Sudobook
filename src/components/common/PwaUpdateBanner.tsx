import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw } from 'lucide-react';

const UPDATE_POLL_MS = 60 * 60 * 1000;

function scheduleUpdateChecks(registration: ServiceWorkerRegistration): void {
  const poll = () => {
    void registration.update().catch(() => {
      /* offline or check failed — ignore */
    });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') poll();
  });
  window.addEventListener('focus', poll);
  window.setInterval(poll, UPDATE_POLL_MS);
}

/**
 * Prompts when a new app build is waiting in the service worker.
 * User taps Reload to activate — avoids surprise reloads mid-form (prompt mode).
 */
export function PwaUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) scheduleUpdateChecks(registration);
    },
    onRegisterError(err) {
      console.warn('[PwaUpdateBanner] service worker registration failed', err);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-[190] mx-3 flex items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand px-4 py-3 shadow-lg shadow-black/40 md:bottom-4 md:mx-auto md:max-w-md">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">Update available</p>
        <p className="text-xs text-white/80">Reload for the latest Sudo Books version</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="min-h-[40px] rounded-lg px-2.5 text-xs font-medium text-white/90 active:bg-white/10"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => void updateServiceWorker(true)}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-semibold text-brand active:bg-white/90"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reload
        </button>
      </div>
    </div>
  );
}
