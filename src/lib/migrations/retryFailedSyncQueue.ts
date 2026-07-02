/** Legacy Supabase sync queue retry — no-op after Dexie Cloud migration. */
export const RETRY_FAILED_SYNC_MIGRATION = 'retry-failed-sync-queue-v1';

export async function retryFailedSyncQueue(): Promise<void> {
  /* syncQueue table removed in Dexie schema v6 */
}
