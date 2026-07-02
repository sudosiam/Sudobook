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

let configured = false;

/** Wire Dexie Cloud once at app boot. Safe to call multiple times. */
export function configureDexieCloud(): void {
  if (!isDexieCloudConfigured || configured) return;
  configured = true;

  db.cloud.configure({
    databaseUrl: databaseUrl!.trim(),
    requireAuth: false,
    nameSuffix: false,
    socialAuth: false,
    unsyncedTables: [...LOCAL_ONLY_STORES],
  });
}

/** Whether the current Dexie Cloud session is authenticated. */
export function isCloudLoggedIn(): boolean {
  if (!isDexieCloudConfigured) return false;
  return db.cloud.currentUser.value.isLoggedIn === true;
}
