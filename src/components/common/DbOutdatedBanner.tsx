import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { onDbOutdated } from '@/lib/db';

/**
 * Fires when another tab/device upgraded the local database schema and this
 * tab's connection had to close. Without this, further saves here would
 * throw raw IndexedDB errors ("DatabaseClosedError") with no explanation.
 */
export function DbOutdatedBanner() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => onDbOutdated(() => setOutdated(true)), []);

  if (!outdated) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex items-center justify-between gap-3 bg-warning px-4 py-2.5 pt-[calc(0.625rem+env(safe-area-inset-top,0px))] text-sm font-medium text-black shadow-lg">
      <span>A newer version of this app was opened elsewhere. Reload to keep saving.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-black/10 px-3 py-1.5 font-semibold active:bg-black/20"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  );
}
