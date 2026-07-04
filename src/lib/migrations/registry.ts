import { DET_IDS_MIGRATION, migrateDeterministicIds } from '@/lib/migrations/deterministicIds';
import {
  CATEGORY_SLUG_MIGRATION,
  migrateCategorySlugIds,
} from '@/lib/migrations/categorySlugToUuid';
import {
  CATEGORY_UUID_HEX_MIGRATION,
  migrateCategoryUuidHexFix,
} from '@/lib/migrations/categoryUuidHexFix';
import {
  SCRUB_INVALID_RECORD_IDS_MIGRATION,
  scrubInvalidRecordIds,
} from '@/lib/migrations/scrubInvalidRecordIds';
import {
  VOID_REVERSAL_CLEANUP_MIGRATION,
  migrateVoidDoubleReversals,
} from '@/lib/migrations/voidReversalCleanup';
import {
  CLEAR_DEFAULT_BUSINESS_NAME_MIGRATION,
  clearDefaultBusinessName,
} from '@/lib/migrations/clearDefaultBusinessName';

/** One local data migration — tracked in `settings.migrations` after success. */
export interface DataMigration {
  id: string;
  run: () => Promise<void>;
}

/**
 * Ordered list of one-time data migrations. Append only — never reorder or remove.
 * Schema/index changes belong in `db.ts` Dexie versions, not here.
 */
export const DATA_MIGRATIONS: DataMigration[] = [
  { id: DET_IDS_MIGRATION, run: migrateDeterministicIds },
  { id: VOID_REVERSAL_CLEANUP_MIGRATION, run: async () => { await migrateVoidDoubleReversals(); } },
  { id: CATEGORY_SLUG_MIGRATION, run: migrateCategorySlugIds },
  { id: CATEGORY_UUID_HEX_MIGRATION, run: migrateCategoryUuidHexFix },
  { id: SCRUB_INVALID_RECORD_IDS_MIGRATION, run: scrubInvalidRecordIds },
  /** Legacy no-op — token kept so upgraded installs do not re-run removed cloud-sync logic. */
  { id: 'retry-failed-sync-queue-v1', run: async () => {} },
  { id: CLEAR_DEFAULT_BUSINESS_NAME_MIGRATION, run: clearDefaultBusinessName },
];
