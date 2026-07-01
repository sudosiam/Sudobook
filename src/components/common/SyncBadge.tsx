import { useSyncStore } from '@/store/useSyncStore';
import { useSync } from '@/hooks/useSync';

export function SyncBadge() {
  const isOnline = useSyncStore((s) => s.isOnline);
  const status = useSyncStore((s) => s.status);
  const { pendingCount, syncNow, isSupabaseConfigured } = useSync();

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
      <span className="flex items-center gap-1 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-disabled" />
        Offline
      </span>
    );
  }

  if (status === 'syncing') {
    return (
      <span className="flex items-center gap-1 text-xs text-brand-light">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-light" />
        Syncing…
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <button onClick={() => void syncNow()} className="flex items-center gap-1 text-xs text-warning">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
        Pending ({pendingCount})
      </button>
    );
  }

  return (
    <button onClick={() => void syncNow()} className="flex items-center gap-1 text-xs text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Synced
    </button>
  );
}
