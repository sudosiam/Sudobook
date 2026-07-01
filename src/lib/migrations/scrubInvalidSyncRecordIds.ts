import { db, now } from '@/lib/db';
import {
  brokenCategoryUuid,
  DEFAULT_CATEGORIES,
} from '@/lib/categories';
import {
  isLegacyCategorySlug,
  legacySlugToCategoryUuid,
} from '@/lib/migrations/categorySlugToUuid';
import { enqueueSync } from '@/lib/sync';
import { isBrokenCategoryUuid, isValidSyncRecordId } from '@/lib/syncIds';

export const SCRUB_INVALID_SYNC_IDS_MIGRATION = 'scrub-invalid-sync-ids-v1';

/**
 * One-time safety pass: drop sync-queue rows with non-uuid recordIds (any table)
 * and remap products still pointing at legacy slug / broken category ids.
 */
export async function scrubInvalidSyncRecordIds(): Promise<void> {
  const settings = await db.settings.get('singleton');
  if (!settings) return;
  if (settings.migrations?.includes(SCRUB_INVALID_SYNC_IDS_MIGRATION)) return;

  await db.transaction(
    'rw',
    [db.products, db.syncQueue, db.settings],
    async () => {
      const queue = await db.syncQueue.toArray();
      for (const item of queue) {
        if (!isValidSyncRecordId(item.recordId)) {
          await db.syncQueue.delete(item.id);
        }
      }

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
        if (canonical !== p.category && isValidSyncRecordId(canonical)) {
          const fixed = { ...p, category: canonical, updatedAt: now() };
          await db.products.put(fixed);
          await enqueueSync('products', 'update', fixed.id, fixed);
        }
      }

      const migrations = [...(settings.migrations ?? []), SCRUB_INVALID_SYNC_IDS_MIGRATION];
      await db.settings.update('singleton', { migrations });
    },
  );
}
