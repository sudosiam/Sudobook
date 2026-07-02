import { useLiveQuery } from 'dexie-react-hooks';
import { useSyncStore } from '@/store/useSyncStore';
import { useSync } from '@/hooks/useSync';
import { db } from '@/lib/db';
import { formatSyncAgo } from '@/lib/display';
import { cn } from '@/lib/utils';

type SyncDotState = 'local' | 'offline' | 'syncing' | 'pending' | 'failed' | 'synced';

function dotClasses(state: SyncDotState): string {
  switch (state) {
    case 'syncing':
      return 'bg-brand-light animate-pulse';
    case 'pending':
      return 'bg-warning animate-pulse';
    case 'failed':
      return 'bg-danger animate-pulse';
    case 'synced':
      return 'bg-success';
    case 'offline':
    case 'local':
    default:
      return 'bg-disabled';
  }
}

/** Compact top-bar sync indicator — dot only so it does not crowd the menu button. */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const isOnline = useSyncStore((s) => s.isOnline);
  const status = useSyncStore((s) => s.status);
  const { pendingCount, failedCount, syncNow, isSupabaseConfigured } = useSync();
  const lastSyncAt = useLiveQuery(() => db.settings.get('singleton').then((s) => s?.lastSyncAt ?? null), []);
  const syncedAgo = formatSyncAgo(lastSyncAt ?? undefined);

  let state: SyncDotState = 'synced';
  let label = syncedAgo ? `Synced ${syncedAgo}` : 'Synced';

  if (!isSupabaseConfigured) {
    state = 'local';
    label = 'Local only — cloud sync not configured';
  } else if (!isOnline) {
    state = 'offline';
    label = 'Offline';
  } else if (status === 'syncing') {
    state = 'syncing';
    label = 'Syncing…';
  } else if (failedCount > 0) {
    state = 'failed';
    label = `${failedCount} sync failure${failedCount === 1 ? '' : 's'} — tap to retry`;
  } else if (pendingCount > 0) {
    state = 'pending';
    label = `${pendingCount} change${pendingCount === 1 ? '' : 's'} pending sync — tap to sync`;
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => isSupabaseConfigured && void syncNow()}
        disabled={!isSupabaseConfigured}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg active:bg-surface-hover disabled:opacity-60"
        aria-label={label}
        title={label}
      >
        <span className={cn('h-2 w-2 rounded-full', dotClasses(state))} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => isSupabaseConfigured && void syncNow()}
      disabled={!isSupabaseConfigured}
      className="flex min-h-[32px] items-center gap-1.5 rounded-lg px-1.5 text-xs disabled:opacity-60"
      aria-label={label}
      title={label}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClasses(state))} />
      <span
        className={cn(
          state === 'failed' && 'text-danger',
          state === 'pending' && 'text-warning',
          state === 'syncing' && 'text-brand-light',
          state === 'synced' && 'text-success',
          (state === 'offline' || state === 'local') && 'text-muted',
        )}
      >
        {label}
      </span>
    </button>
  );
}
