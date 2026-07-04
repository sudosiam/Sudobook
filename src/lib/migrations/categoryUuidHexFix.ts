import { db, now, type ProductCategory } from '@/lib/db';
import {
  DEFAULT_CATEGORIES,
  brokenCategoryUuid,
} from '@/lib/categories';

export const CATEGORY_UUID_HEX_MIGRATION = 'category-uuid-hex-v2';

/**
 * v2.0.x used category ids like `…-escooter0000` (non-hex tail). Re-key defaults
 * to fixed hex UUIDs and remap products.
 */
export async function migrateCategoryUuidHexFix(): Promise<void> {
  await db.transaction(
    'rw',
    [db.productCategories, db.products],
    async () => {
      for (const seed of DEFAULT_CATEGORIES) {
        const newId = seed.id;
        const oldIds = new Set<string>();
        if (seed.legacySlug) {
          oldIds.add(seed.legacySlug);
          oldIds.add(brokenCategoryUuid(seed.legacySlug));
        }
        oldIds.delete(newId);

        let mergedSkuSeq = 0;
        for (const oldId of oldIds) {
          const oldCat = await db.productCategories.get(oldId);
          if (oldCat) {
            mergedSkuSeq = Math.max(mergedSkuSeq, oldCat.skuSeq ?? 0);
            await db.productCategories.delete(oldId);
          }

          const products = await db.products.filter((p) => p.category === oldId).toArray();
          for (const p of products) {
            const fixed = { ...p, category: newId, updatedAt: now() };
            await db.products.put(fixed);
          }
        }

        const existing = await db.productCategories.get(newId);
        const category: ProductCategory = {
          id: newId,
          name: existing?.name ?? seed.name,
          skuPrefix: existing?.skuPrefix ?? seed.skuPrefix,
          skuSeq: Math.max(existing?.skuSeq ?? 0, mergedSkuSeq),
          isActive: existing?.isActive ?? true,
          createdAt: existing?.createdAt ?? now(),
          updatedAt: now(),
        };
        await db.productCategories.put(category);
      }
    },
  );
}
