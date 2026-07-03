import { db, now } from '@/lib/db';
import {
  brokenCategoryUuid,
  DEFAULT_CATEGORIES,
} from '@/lib/categories';
import {
  isLegacyCategorySlug,
  legacySlugToCategoryUuid,
} from '@/lib/migrations/categorySlugToUuid';
import { isBrokenCategoryUuid, isValidRecordId } from '@/lib/recordIds';

/** Token value is historical — do not change (stored in settings.migrations). */
export const SCRUB_INVALID_RECORD_IDS_MIGRATION = 'scrub-invalid-sync-ids-v1';

/**
 * One-time safety pass: remap products still pointing at legacy slug / broken category ids.
 */
export async function scrubInvalidRecordIds(): Promise<void> {
  await db.transaction('rw', [db.products], async () => {
    const brokenToCanonical = new Map<string, string>();
    for (const seed of DEFAULT_CATEGORIES) {
      if (seed.legacySlug) {
        brokenToCanonical.set(seed.legacySlug, seed.id);
        brokenToCanonical.set(brokenCategoryUuid(seed.legacySlug), seed.id);
      }
    }

    const products = await db.products.toArray();
    for (const p of products) {
      let canonical = p.category;
      if (isLegacyCategorySlug(p.category)) {
        canonical = legacySlugToCategoryUuid(p.category) ?? canonical;
      } else if (isBrokenCategoryUuid(p.category)) {
        canonical = brokenToCanonical.get(p.category) ?? canonical;
      }
      if (canonical !== p.category && isValidRecordId(canonical)) {
        const fixed = { ...p, category: canonical, updatedAt: now() };
        await db.products.put(fixed);
      }
    }
  });
}
