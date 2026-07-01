import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { db } from '@/lib/db';
import { Button } from '@/components/common/Field';
import { useSync } from '@/hooks/useSync';
import { useOnline } from '@/hooks/useOnline';
import { useSyncStore } from '@/store/useSyncStore';
import { useSettings } from '@/hooks/useSettings';
import { verifySupabaseSchema, type SupabaseSchemaStatus } from '@/lib/supabaseSchema';

function fmt(iso?: string): string {
  if (!iso) return 'never';
  try {
    return format(new Date(iso), 'dd MMM yyyy, HH:mm');
  } catch {
    return iso;
  }
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

  const [schema, setSchema] = useState<SupabaseSchemaStatus | null>(null);

  useEffect(() => {
    if (!activeUserId) {
      setSchema(null);
      return;
    }
    void verifySupabaseSchema().then(setSchema);
  }, [activeUserId, status]);

  if (!isSupabaseConfigured) {
    return (
      <div className="card text-sm text-muted">
        Running in local-only mode. Add Supabase env vars to enable cloud sync &amp; backup.
      </div>
    );
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
      ? 'Offline — will sync when back online'
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
          Missing in Supabase: {schema.missing.join(', ')}. Run{' '}
          <span className="font-mono">RUN_ME_PENDING.sql</span> in Supabase Dashboard → SQL Editor.
        </p>
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
