import { db, now, type ProductCategory } from '@/lib/db';
import { DEFAULT_CATEGORIES } from '@/lib/categories';
import { enqueueSync } from '@/lib/sync';
import { isValidSyncRecordId } from '@/lib/syncIds';

export const CATEGORY_SLUG_MIGRATION = 'category-slug-to-uuid-v1';

const LEGACY_SLUGS = ['escooter', 'erickshaw', 'battery', 'part', 'other'] as const;

/**
 * Default categories originally used slug ids ('escooter', …) so existing
 * Product.category values kept working locally. Supabase mirror tables require
 * uuid primary keys — migrate slugs → deterministic UUIDs and purge bad sync
 * queue rows that can never succeed.
 */
export async function migrateCategorySlugIds(): Promise<void> {
  const settings = await db.settings.get('singleton');
  if (!settings) return;
  if (settings.migrations?.includes(CATEGORY_SLUG_MIGRATION)) return;

  await db.transaction(
    'rw',
    [db.productCategories, db.products, db.syncQueue, db.settings],
    async () => {
      for (const seed of DEFAULT_CATEGORIES) {
        const newId = seed.id;
        const legacySlug = seed.legacySlug;
        if (!legacySlug) continue;

        const oldCat = await db.productCategories.get(legacySlug);
        const products = await db.products.filter((p) => p.category === legacySlug).toArray();

        for (const p of products) {
          const fixed = { ...p, category: newId, updatedAt: now() };
          await db.products.put(fixed);
          await enqueueSync('products', 'update', fixed.id, fixed);
        }

        const existingNew = await db.productCategories.get(newId);
        if (oldCat) {
          if (existingNew) {
            await db.productCategories.update(newId, {
              skuSeq: Math.max(existingNew.skuSeq ?? 0, oldCat.skuSeq ?? 0),
              updatedAt: now(),
            });
            await db.productCategories.delete(legacySlug);
            const updated = await db.productCategories.get(newId);
            if (updated) await enqueueSync('product_categories', 'update', newId, updated);
          } else {
            const migrated: ProductCategory = { ...oldCat, id: newId, updatedAt: now() };
            await db.productCategories.delete(legacySlug);
            await db.productCategories.put(migrated);
            await enqueueSync('product_categories', 'create', newId, migrated);
          }
        } else if (!existingNew) {
          const category: ProductCategory = {
            id: newId,
            name: seed.name,
            skuPrefix: seed.skuPrefix,
            skuSeq: 0,
            isActive: true,
            createdAt: now(),
            updatedAt: now(),
          };
          await db.productCategories.put(category);
          await enqueueSync('product_categories', 'create', newId, category);
        }
      }

      // Drop sync-queue rows that can never succeed (non-uuid category ids).
      const catQueue = await db.syncQueue.filter((i) => i.table === 'product_categories').toArray();
      for (const item of catQueue) {
        if (!isValidSyncRecordId(item.recordId) || LEGACY_SLUGS.includes(item.recordId as (typeof LEGACY_SLUGS)[number])) {
          await db.syncQueue.delete(item.id);
        }
      }

      const migrations = [...(settings.migrations ?? []), CATEGORY_SLUG_MIGRATION];
      await db.settings.update('singleton', { migrations });
    },
  );
}

/** True when id is one of the legacy slug primary keys (invalid for Supabase). */
export function isLegacyCategorySlug(id: string): boolean {
  return (LEGACY_SLUGS as readonly string[]).includes(id);
}

/** Map a legacy slug to its deterministic UUID (for display/migration helpers). */
export function legacySlugToCategoryUuid(slug: string): string | null {
  const seed = DEFAULT_CATEGORIES.find((s) => s.legacySlug === slug);
  return seed?.id ?? null;
}
