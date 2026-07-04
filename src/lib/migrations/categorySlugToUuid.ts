import { db, now, type ProductCategory } from '@/lib/db';
import { DEFAULT_CATEGORIES } from '@/lib/categories';

export const CATEGORY_SLUG_MIGRATION = 'category-slug-to-uuid-v1';

const LEGACY_SLUGS = ['escooter', 'erickshaw', 'battery', 'part', 'other'] as const;

/**
 * Default categories originally used slug ids ('escooter', …) so existing
 * Product.category values kept working locally. Migrate slugs → deterministic UUIDs.
 */
export async function migrateCategorySlugIds(): Promise<void> {
  await db.transaction(
    'rw',
    [db.productCategories, db.products],
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
        }

        const existingNew = await db.productCategories.get(newId);
        if (oldCat) {
          if (existingNew) {
            await db.productCategories.update(newId, {
              skuSeq: Math.max(existingNew.skuSeq ?? 0, oldCat.skuSeq ?? 0),
              updatedAt: now(),
            });
            await db.productCategories.delete(legacySlug);
          } else {
            const migrated: ProductCategory = { ...oldCat, id: newId, updatedAt: now() };
            await db.productCategories.delete(legacySlug);
            await db.productCategories.put(migrated);
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
        }
      }
    },
  );
}

/** True when id is one of the legacy slug primary keys (pre-UUID migration). */
export function isLegacyCategorySlug(id: string): boolean {
  return (LEGACY_SLUGS as readonly string[]).includes(id);
}

/** Map a legacy slug to its deterministic UUID (for display/migration helpers). */
export function legacySlugToCategoryUuid(slug: string): string | null {
  const seed = DEFAULT_CATEGORIES.find((s) => s.legacySlug === slug);
  return seed?.id ?? null;
}
