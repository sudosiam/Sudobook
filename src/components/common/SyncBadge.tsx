import { useSyncStore } from '@/store/useSyncStore';
import { useSync } from '@/hooks/useSync';
import { useAppStore } from '@/store/useAppStore';
import { isCloudLoggedIn } from '@/lib/cloud';
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
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const { pendingCount, failedCount, syncNow, isCloudConfigured } = useSync();
  const activeUserId = useAppStore((s) => s.activeUserId);
  const loggedIn = Boolean(activeUserId) || isCloudLoggedIn();
  const syncedAgo = formatSyncAgo(lastSyncAt ?? undefined);

  let state: SyncDotState = 'synced';
  let label = syncedAgo ? `Synced ${syncedAgo}` : 'Synced';

  if (!isCloudConfigured) {
    state = 'local';
    label = 'Local only — cloud not configured';
  } else if (!loggedIn) {
    state = 'local';
    label = 'Sign in for cloud backup — Settings';
  } else if (!isOnline) {
    state = 'offline';
    label = 'Offline';
  } else if (status === 'syncing') {
    state = 'syncing';
    label = 'Syncing…';
  } else if (failedCount > 0) {
    state = 'failed';
    label = 'Sync error — tap to retry';
  } else if (pendingCount > 0) {
    state = 'pending';
    label = 'Changes pending sync — tap to sync';
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => isCloudConfigured && loggedIn && void syncNow()}
        disabled={!isCloudConfigured || !loggedIn}
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
      onClick={() => isCloudConfigured && loggedIn && void syncNow()}
      disabled={!isCloudConfigured || !loggedIn}
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
