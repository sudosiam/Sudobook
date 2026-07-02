import { format } from 'date-fns';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/common/Field';
import { useSync } from '@/hooks/useSync';
import { useOnline } from '@/hooks/useOnline';
import { useSyncStore } from '@/store/useSyncStore';
import { isCloudLoggedIn } from '@/lib/cloud';

function fmt(iso?: string | null): string {
  if (!iso) return 'never';
  try {
    return format(new Date(iso), 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
}

/** Dexie Cloud sync status and manual trigger. */
export function SyncPanel({ activeUserId }: { activeUserId: string | null }) {
  const online = useOnline();
  const status = useSyncStore((s) => s.status);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const { syncNow, isCloudConfigured } = useSync();

  if (!isCloudConfigured) {
    return <div className="card text-sm text-muted">Local only — add VITE_DEXIE_CLOUD_URL to enable cloud backup</div>;
  }

  const loggedIn = Boolean(activeUserId) || isCloudLoggedIn();
  const phase = status === 'syncing' ? 'Syncing…' : status === 'error' ? 'Sync error' : 'Up to date';

  const dotClass = !loggedIn
    ? 'bg-disabled'
    : !online
      ? 'bg-warning'
      : status === 'syncing'
        ? 'bg-brand-light animate-pulse'
        : status === 'error'
          ? 'bg-danger'
          : 'bg-success';

  const label = !loggedIn
    ? 'Sign in to activate cloud backup'
    : !online
      ? 'Offline — changes saved locally'
      : phase;

  return (
    <div className="card page-stack">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted">Pending</dt>
        <dd className="text-right font-numeric text-foreground tabular-nums">{pendingCount}</dd>
        <dt className="text-muted">Last sync</dt>
        <dd className="text-right text-foreground">{fmt(lastSyncAt)}</dd>
        <dt className="text-muted">Engine</dt>
        <dd className="text-right text-success">Dexie Cloud</dd>
      </dl>

      {!loggedIn && (
        <p className="text-xs text-muted">
          You can use the app offline without signing in. When you sign in, your local books upload to your cloud
          account automatically.
        </p>
      )}

      <Button
        variant="secondary"
        disabled={!loggedIn || !online || status === 'syncing'}
        onClick={() => void syncNow()}
      >
        <RefreshCw className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
        Sync Now
      </Button>
    </div>
  );
}
