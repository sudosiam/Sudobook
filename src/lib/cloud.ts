import { db } from '@/lib/db';

const databaseUrl = import.meta.env.VITE_DEXIE_CLOUD_URL as string | undefined;

/** True when a Dexie Cloud database URL is configured. */
export const isDexieCloudConfigured = Boolean(databaseUrl?.trim());

/** Dexie stores replicated to Dexie Cloud (everything except local-only tables). */
export const CLOUD_SYNCED_STORES = [
  'accounts',
  'journalEntries',
  'customers',
  'vendors',
  'products',
  'productCategories',
  'sales',
  'purchases',
  'expenses',
  'recurringExpenses',
  'bankAccounts',
  'bankTransactions',
  'stockMovements',
] as const;

/** Tables that stay on-device only — never uploaded to Dexie Cloud. */
export const LOCAL_ONLY_STORES = ['settings', 'dashboardCache', 'backupSnapshots', 'backupFolder'] as const;

/**
 * No-op — Dexie Cloud is now configured in the SudoBooksDB constructor so it
 * runs before the database opens. This function is kept for call-site
 * compatibility only.
 */
export function configureDexieCloud(): void {
  // intentional no-op — configuration happens in db.ts constructor
}

/** Whether the current Dexie Cloud session is authenticated. */
export function isCloudLoggedIn(): boolean {
  if (!isDexieCloudConfigured) return false;
  return db.cloud.currentUser.value.isLoggedIn === true;
}
