import { supabase, isSupabaseConfigured } from '@/lib/supabase';

/** Every Dexie store ↔ Supabase mirror table used by sync. */
export const SYNC_TABLE_MAP = [
  { local: 'accounts', remote: 'accounts' },
  { local: 'journalEntries', remote: 'journal_entries' },
  { local: 'customers', remote: 'customers' },
  { local: 'vendors', remote: 'vendors' },
  { local: 'products', remote: 'products' },
  { local: 'productCategories', remote: 'product_categories' },
  { local: 'sales', remote: 'sales' },
  { local: 'purchases', remote: 'purchases' },
  { local: 'expenses', remote: 'expenses' },
  { local: 'recurringExpenses', remote: 'recurring_expenses' },
  { local: 'bankAccounts', remote: 'bank_accounts' },
  { local: 'bankTransactions', remote: 'bank_transactions' },
  { local: 'stockMovements', remote: 'stock_movements' },
] as const;

export type RemoteSyncTable = (typeof SYNC_TABLE_MAP)[number]['remote'];

export const REMOTE_SYNC_TABLES: readonly RemoteSyncTable[] = SYNC_TABLE_MAP.map((t) => t.remote);

export function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string; status?: number; statusCode?: number };
  const message = e.message ?? '';
  return (
    e.code === 'PGRST205' ||
    e.status === 404 ||
    e.statusCode === 404 ||
    message.includes('Could not find the table') ||
    /relation .* does not exist/i.test(message)
  );
}

export interface SupabaseSchemaStatus {
  total: number;
  ready: number;
  missing: RemoteSyncTable[];
  checkedAt: string;
}

let lastStatus: SupabaseSchemaStatus | null = null;

export function getSupabaseSchemaStatus(): SupabaseSchemaStatus | null {
  return lastStatus;
}

/**
 * Probe every mirror table through @supabase/supabase-js (authenticated when
 * the user is signed in). Permission-denied means the table exists; 404 /
 * PGRST205 means the migration hasn't been applied in Supabase yet.
 */
export async function verifySupabaseSchema(): Promise<SupabaseSchemaStatus> {
  const total = REMOTE_SYNC_TABLES.length;
  const missing: RemoteSyncTable[] = [];

  if (!isSupabaseConfigured || !supabase) {
    lastStatus = { total, ready: 0, missing: [...REMOTE_SYNC_TABLES], checkedAt: new Date().toISOString() };
    return lastStatus;
  }

  for (const table of REMOTE_SYNC_TABLES) {
    const { error } = await supabase.from(table).select('id').limit(0);
    if (error && isMissingTableError(error)) missing.push(table);
  }

  lastStatus = {
    total,
    ready: total - missing.length,
    missing,
    checkedAt: new Date().toISOString(),
  };
  return lastStatus;
}
