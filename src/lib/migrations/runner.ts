import { db } from '@/lib/db';
import { DEFAULT_CATEGORIES, syncDefaultCategories } from '@/lib/categories';
import { DEFAULT_ACCOUNTS, accountUuid, CASH_DRAWER_ID } from '@/lib/coa';
import { invalidateCodeToIdMap } from '@/lib/transactions';
import { assertBuiltInSyncIds } from '@/lib/syncIds';
import { DET_IDS_MIGRATION, syncMissingDefaultAccounts } from '@/lib/migrations/deterministicIds';
import { DATA_MIGRATIONS } from '@/lib/migrations/registry';

/** Short random per-device code (e.g. "A3F9K2") keeps document numbers unique across devices. */
function makeDeviceId(): string {
  const n = Math.floor(Math.random() * 36 ** 6);
  return n.toString(36).padStart(6, '0').toUpperCase();
}

async function markMigrationDone(id: string): Promise<void> {
  const settings = await db.settings.get('singleton');
  if (!settings) throw new Error('[runMigrations] Settings missing — cannot record migration');
  const recorded = new Set(settings.migrations ?? []);
  if (recorded.has(id)) return;
  recorded.add(id);
  await db.settings.update('singleton', { migrations: [...recorded] });
}

/**
 * Run pending one-time **data** migrations on every app bootstrap.
 *
 * Dexie `version(n).stores()` in `db.ts` handles **schema** only (tables/indexes).
 * Data backfills live here, gated by tokens in `settings.migrations`.
 */
export async function runMigrations(): Promise<void> {
  const settings = await db.settings.get('singleton');
  if (!settings) return;

  if (!settings.deviceId) {
    await db.settings.update('singleton', { deviceId: makeDeviceId() });
  }

  const done = new Set(settings.migrations ?? []);

  for (const migration of DATA_MIGRATIONS) {
    if (done.has(migration.id)) continue;
    try {
      await migration.run();
      await markMigrationDone(migration.id);
      done.add(migration.id);
    } catch (err) {
      console.error(`[runMigrations] ${migration.id}`, err);
      throw err;
    }
  }

  await syncMissingDefaultAccounts();
  await syncDefaultCategories();
  assertBuiltInSyncIds(
    DEFAULT_ACCOUNTS.map((a) => accountUuid(a.code)),
    'account',
  );
  assertBuiltInSyncIds(
    DEFAULT_CATEGORIES.map((c) => c.id),
    'product category',
  );
  assertBuiltInSyncIds([CASH_DRAWER_ID], 'cash drawer');
  invalidateCodeToIdMap();
}

/** Token pre-marked on fresh installs that already use deterministic ids. */
export const INITIAL_MIGRATION_TOKENS = [DET_IDS_MIGRATION] as const;
