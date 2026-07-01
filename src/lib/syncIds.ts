/**
 * UUID format accepted by Supabase/Postgres `uuid` columns and used as sync `recordId`.
 * Matches RFC 4122 variant/version nibble rules (same as prior sync queue checks).
 */
export const SYNC_RECORD_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `id` is safe to use as a Supabase mirror table primary key. */
export function isValidSyncRecordId(id: string): boolean {
  return SYNC_RECORD_ID_RE.test(id);
}

/** Every segment must be hex — catches ids like `…-escooter0000`. */
export function isHexUuidString(id: string): boolean {
  const parts = id.split('-');
  if (parts.length !== 5) return false;
  return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/** v2.0.x default category ids used slug text in the uuid tail (invalid for Postgres). */
export function isBrokenCategoryUuid(id: string): boolean {
  return id.startsWith('0cat0000-0000-4000-8000-');
}

/** Assert all built-in deterministic ids are Postgres-safe (dev / migration sanity). */
export function assertBuiltInSyncIds(ids: readonly string[], label: string): void {
  for (const id of ids) {
    if (!isValidSyncRecordId(id)) {
      throw new Error(`[assertBuiltInSyncIds] Invalid ${label} sync id: ${id}`);
    }
    if (!isHexUuidString(id)) {
      throw new Error(`[assertBuiltInSyncIds] Non-hex ${label} sync id: ${id}`);
    }
  }
}
