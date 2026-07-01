import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncStore } from '@/store/useSyncStore';
import { useSync } from '@/hooks/useSync';
import { db } from '@/lib/db';
import { formatSyncAgo } from '@/lib/display';

export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const isOnline = useSyncStore((s) => s.isOnline);
  const status = useSyncStore((s) => s.status);
  const { pendingCount, failedCount, syncNow, isSupabaseConfigured } = useSync();
  const lastSyncAt = useLiveQuery(() => db.settings.get('singleton').then((s) => s?.lastSyncAt ?? null), []);
  const syncedAgo = formatSyncAgo(lastSyncAt ?? undefined);

  if (!isSupabaseConfigured) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-disabled" />
        Local
      </span>
    );
  }

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted" title="Offline">
        <span className="h-1.5 w-1.5 rounded-full bg-disabled" />
        Offline
      </span>
    );
  }

  if (status === 'syncing') {
    return (
      <span className="flex min-h-[32px] items-center gap-1 rounded-lg px-1.5 text-xs text-brand-light">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-light" />
        Syncing…
      </span>
    );
  }

  if (pendingCount > 0 || failedCount > 0) {
    return (
      <button
        type="button"
        onClick={() => void syncNow()}
        className="flex min-h-[32px] items-center gap-1 rounded-lg px-1.5 text-xs text-warning"
      >
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
        {failedCount > 0 ? `Failed (${failedCount})` : `Pending (${pendingCount})`}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      className="flex min-h-[32px] max-w-[9rem] items-center gap-1 truncate rounded-lg px-1.5 text-xs text-success"
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
      {compact ? 'Synced' : syncedAgo ? `Synced ${syncedAgo}` : 'Synced'}
    </button>
  );
}
