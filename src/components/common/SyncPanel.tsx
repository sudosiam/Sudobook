import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { db, type SyncQueueItem } from '@/lib/db';
import { Button } from '@/components/common/Field';
import { useSync } from '@/hooks/useSync';
import { useOnline } from '@/hooks/useOnline';
import { useSyncStore } from '@/store/useSyncStore';
import { useSettings } from '@/hooks/useSettings';
import { dismissFailedSyncItem } from '@/lib/sync';
import { verifySupabaseSchema, type SupabaseSchemaStatus } from '@/lib/supabaseSchema';
import { toast } from '@/store/useToast';

function fmt(iso?: string): string {
  if (!iso) return 'never';
  try {
    return format(new Date(iso), 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
}

function failedLabel(item: SyncQueueItem): string {
  const shortId = item.recordId.slice(0, 8);
  return `${item.table} · ${shortId}…`;
}

/** Cloud sync status: pending/failed counts, last push/pull, manual trigger. */
export function SyncPanel({ activeUserId }: { activeUserId: string | null }) {
  const settings = useSettings();
  const online = useOnline();
  const status = useSyncStore((s) => s.status);
  const { syncNow, isSupabaseConfigured } = useSync();

  const pending = useLiveQuery(
    () => db.syncQueue.where('status').equals('pending').count(),
    [],
    0,
  );
  const failed = useLiveQuery(
    () => db.syncQueue.where('status').equals('failed').count(),
    [],
    0,
  );
  const failedItems = useLiveQuery(
    () => db.syncQueue.where('status').equals('failed').limit(8).toArray(),
    [],
    [] as SyncQueueItem[],
  );

  const [schema, setSchema] = useState<SupabaseSchemaStatus | null>(null);

  useEffect(() => {
    if (!activeUserId) {
      setSchema(null);
      return;
    }
    void verifySupabaseSchema().then(setSchema);
  }, [activeUserId, status]);

  const dismissOne = async (id: string) => {
    try {
      await dismissFailedSyncItem(id);
      toast.info('Removed from sync queue');
    } catch (err) {
      console.error('[dismissFailedSyncItem]', err);
      toast.error('Could not remove item');
    }
  };

  if (!isSupabaseConfigured) {
    return <div className="card text-sm text-muted">Local only</div>;
  }

  const dotClass = !activeUserId
    ? 'bg-disabled'
    : !online
      ? 'bg-warning'
      : status === 'syncing'
        ? 'bg-brand-light animate-pulse'
        : status === 'error'
          ? 'bg-danger'
          : 'bg-success';

  const label = !activeUserId
    ? 'Sign in to activate'
    : !online
      ? 'Offline'
      : status === 'syncing'
        ? 'Syncing…'
        : status === 'error'
          ? 'Last sync failed'
          : 'Active';

  return (
    <div className="card page-stack">
      <div className="flex items-center gap-2 text-sm text-foreground">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-muted">Pending</dt>
        <dd className="text-right font-numeric text-foreground tabular-nums">{pending ?? 0}</dd>
        <dt className="text-muted">Failed</dt>
        <dd
          className={`text-right font-numeric tabular-nums ${(failed ?? 0) > 0 ? 'text-danger' : 'text-foreground'}`}
        >
          {failed ?? 0}
        </dd>
        <dt className="text-muted">Last push</dt>
        <dd className="text-right text-foreground">{fmt(settings?.lastSyncAt)}</dd>
        <dt className="text-muted">Last pull</dt>
        <dd className="text-right text-foreground">{fmt(settings?.lastPullAt)}</dd>
        <dt className="text-muted">Device</dt>
        <dd className="text-right font-numeric text-foreground">{settings?.deviceId ?? '—'}</dd>
        {schema && activeUserId && (
          <>
            <dt className="text-muted">Cloud tables</dt>
            <dd
              className={`text-right tabular-nums ${schema.missing.length > 0 ? 'text-warning' : 'text-success'}`}
            >
              {schema.ready}/{schema.total}
            </dd>
          </>
        )}
      </dl>

      {schema && schema.missing.length > 0 && (
        <p className="text-xs text-warning">
          Missing: {schema.missing.join(', ')}
        </p>
      )}

      {(failed ?? 0) > 0 && activeUserId && (
        <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border-app">
          {(failedItems ?? []).map((item) => (
            <li
              key={item.id}
              className="flex min-h-[44px] items-start justify-between gap-2 border-b border-border-app px-3 py-2 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{failedLabel(item)}</p>
                <p className="line-clamp-2 text-[11px] text-muted">
                  {item.lastError ?? (item.permanentFailure ? 'Permanent error' : 'Upload failed')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void dismissOne(item.id)}
                className="flex min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-lg text-muted active:bg-surface-hover"
                aria-label="Dismiss failed sync item"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="secondary"
        disabled={!activeUserId || !online || status === 'syncing'}
        onClick={() => void syncNow()}
      >
        <RefreshCw className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
        {failed && failed > 0 ? 'Retry & Sync Now' : 'Sync Now'}
      </Button>
    </div>
  );
}
