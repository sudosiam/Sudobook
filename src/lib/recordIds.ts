/**
 * RFC 4122 UUID validation for primary keys (Dexie records use string UUIDs).
 */
export const RECORD_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidRecordId(id: string): boolean {
  return RECORD_UUID_RE.test(id);
}

/** Every segment must be hex — catches ids like `…-escooter0000`. */
export function isHexUuidString(id: string): boolean {
  const parts = id.split('-');
  if (parts.length !== 5) return false;
  return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/** v2.0.x default category ids used slug text in the uuid tail (invalid hex). */
export function isBrokenCategoryUuid(id: string): boolean {
  return id.startsWith('0cat0000-0000-4000-8000-');
}

/** Assert all built-in deterministic ids are valid UUIDs (dev / migration sanity). */
export function assertBuiltInRecordIds(ids: readonly string[], label: string): void {
  for (const id of ids) {
    if (!isValidRecordId(id)) {
      throw new Error(`[assertBuiltInRecordIds] Invalid ${label} id: ${id}`);
    }
    if (!isHexUuidString(id)) {
      throw new Error(`[assertBuiltInRecordIds] Non-hex ${label} id: ${id}`);
    }
  }
}
