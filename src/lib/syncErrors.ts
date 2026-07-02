import { isMissingTableError } from '@/lib/supabaseSchema';

/** Classify Supabase / network errors for push retry policy. */
export type SyncFailureKind = 'transient' | 'permanent' | 'rate_limit' | 'auth' | 'missing_table';

export { isMissingTableError };

export function syncErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Unknown error';
  const e = err as { message?: string };
  return e.message ?? 'Unknown error';
}

export function isInvalidUuidSyncError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  return e.code === '22P02' && (e.message?.includes('uuid') ?? false);
}

export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string; code?: string; name?: string };
  return (
    e.status === 429 ||
    e.code === '429' ||
    /rate limit/i.test(e.message ?? '') ||
    (e.name === 'AuthApiError' && /rate limit/i.test(e.message ?? ''))
  );
}

export function isAuthSyncError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string; code?: string };
  const msg = e.message ?? '';
  return (
    e.status === 401 ||
    e.code === 'PGRST301' ||
    /jwt expired/i.test(msg) ||
    /invalid.*token/i.test(msg) ||
    /not authenticated/i.test(msg)
  );
}

export function isRlsSyncError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const msg = e.message ?? '';
  return e.code === '42501' || /row-level security/i.test(msg) || /permission denied/i.test(msg);
}

export function isPayloadTooLargeError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const msg = e.message ?? '';
  return (
    e.code === 'PGRST013' ||
    /payload too large/i.test(msg) ||
    /request entity too large/i.test(msg) ||
    /body exceeded/i.test(msg)
  );
}

export function classifySyncError(err: unknown): SyncFailureKind {
  if (isRateLimitError(err)) return 'rate_limit';
  if (isAuthSyncError(err)) return 'auth';
  if (isMissingTableError(err)) return 'missing_table';
  if (isInvalidUuidSyncError(err) || isRlsSyncError(err) || isPayloadTooLargeError(err)) {
    return 'permanent';
  }
  return 'transient';
}
