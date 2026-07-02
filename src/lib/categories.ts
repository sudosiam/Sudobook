import { db, now, uuid, type ProductCategory } from '@/lib/db';

/** Same sentinel epoch as seed.ts — ensures cloud data always wins over local seed. */
const SEED_EPOCH = '2020-01-01T00:00:00.000Z';

export interface CategorySeed {
  id: string; // deterministic UUID — same on every device (Supabase requires uuid)
  legacySlug?: string; // old slug id before category-slug-to-uuid-v1 migration
  name: string;
  skuPrefix: string;
}

/** Fixed default category UUIDs — hex-only (required by Postgres `uuid` type). */
const DEFAULT_CATEGORY_UUIDS: Record<string, string> = {
  escooter: '0ca70001-0000-4000-8000-000000000001',
  erickshaw: '0ca70002-0000-4000-8000-000000000002',
  battery: '0ca70003-0000-4000-8000-000000000003',
  part: '0ca70004-0000-4000-8000-000000000004',
  other: '0ca70005-0000-4000-8000-000000000005',
};

/**
 * Deterministic UUID for a default category slug so every device seeds the
 * exact same primary key (like accountUuid for chart-of-accounts codes).
 */
export function categoryUuid(slug: string): string {
  const key = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = DEFAULT_CATEGORY_UUIDS[key];
  if (!id) throw new Error(`Unknown default category slug: ${slug}`);
  return id;
}

/** Old broken ids used letters outside hex in the uuid tail — invalid for Supabase. */
export function brokenCategoryUuid(slug: string): string {
  const tail = slug
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .padEnd(12, '0')
    .slice(0, 12);
  return `0cat0000-0000-4000-8000-${tail}`;
}

/**
 * Default categories seeded on first run. IDs are deterministic UUIDs so they
 * sync cleanly to Supabase; legacySlug documents the old enum/slug values for
 * the one-time Dexie migration.
 */
export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { id: categoryUuid('escooter'), legacySlug: 'escooter', name: 'E-Scooter', skuPrefix: 'ESC' },
  { id: categoryUuid('erickshaw'), legacySlug: 'erickshaw', name: 'E-Rickshaw', skuPrefix: 'ERK' },
  { id: categoryUuid('battery'), legacySlug: 'battery', name: 'Battery', skuPrefix: 'BAT' },
  { id: categoryUuid('part'), legacySlug: 'part', name: 'Part', skuPrefix: 'PRT' },
  { id: categoryUuid('other'), legacySlug: 'other', name: 'Other', skuPrefix: 'OTH' },
];

/** Seed default categories that don't exist yet — safe to call repeatedly. */
export async function syncDefaultCategories(): Promise<void> {
  await db.transaction('rw', db.productCategories, async () => {
    for (const seed of DEFAULT_CATEGORIES) {
      const existing = await db.productCategories.get(seed.id);
      if (existing) continue;
      // Legacy slug row — category-slug-to-uuid migration will re-key it.
      if (seed.legacySlug && (await db.productCategories.get(seed.legacySlug))) continue;

      const category: ProductCategory = {
        id: seed.id,
        name: seed.name,
        skuPrefix: seed.skuPrefix,
        skuSeq: 0,
        isActive: true,
        createdAt: SEED_EPOCH,
        updatedAt: SEED_EPOCH,
      };
      await db.productCategories.add(category);
    }
  });
}

function sanitizePrefix(input: string): string {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  return cleaned || 'GEN';
}

export interface NewCategoryInput {
  name: string;
  skuPrefix: string;
}

export async function createProductCategory(input: NewCategoryInput): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Category name required');
  const skuPrefix = sanitizePrefix(input.skuPrefix || name);

  const id = uuid();
  await db.transaction('rw', db.productCategories, async () => {
    const dupe = await db.productCategories
      .filter((c) => c.isActive && c.name.toLowerCase() === name.toLowerCase())
      .first();
    if (dupe) throw new Error(`Category "${name}" already exists`);

    const category: ProductCategory = {
      id,
      name,
      skuPrefix,
      skuSeq: 0,
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.productCategories.add(category);
  });
  return id;
}

export async function updateProductCategory(
  id: string,
  patch: Partial<Pick<ProductCategory, 'name' | 'skuPrefix' | 'isActive'>>,
): Promise<void> {
  await db.transaction('rw', db.productCategories, async () => {
    const next: Partial<ProductCategory> = { ...patch, updatedAt: now() };
    if (patch.skuPrefix) next.skuPrefix = sanitizePrefix(patch.skuPrefix);
    await db.productCategories.update(id, next);
  });
}

function formatSku(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

/** Peek the next auto-SKU for a category WITHOUT consuming it (for live preview in a form). */
export async function previewNextSku(categoryId: string): Promise<string> {
  const cat = await db.productCategories.get(categoryId);
  if (!cat) return '';
  return formatSku(cat.skuPrefix, (cat.skuSeq ?? 0) + 1);
}

/**
 * Atomically claim the next auto-SKU for a category. Caller MUST already be
 * inside a Dexie rw transaction that includes productCategories.
 */
export async function claimNextSkuTx(categoryId: string): Promise<string> {
  const cat = await db.productCategories.get(categoryId);
  if (!cat) throw new Error('Category not found');
  const nextSeq = (cat.skuSeq ?? 0) + 1;
  await db.productCategories.update(categoryId, { skuSeq: nextSeq, updatedAt: now() });
  return formatSku(cat.skuPrefix, nextSeq);
}
