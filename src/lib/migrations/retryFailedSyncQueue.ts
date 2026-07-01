import { db } from '@/lib/db';

export const RETRY_FAILED_SYNC_MIGRATION = 'retry-failed-sync-v1';

/**
 * Cloud sync items that hit missing tables / RLS gaps were marked `failed`
 * after 3 retries. Reset them so the next automatic sync run can push again
 * once Supabase migrations are applied.
 */
export async function retryFailedSyncQueue(): Promise<void> {
  const failed = await db.syncQueue.where('status').equals('failed').toArray();
  if (failed.length === 0) return;

  await db.transaction('rw', db.syncQueue, async () => {
    for (const item of failed) {
      await db.syncQueue.update(item.id, { status: 'pending', retryCount: 0 });
    }
  });

  console.info(`[retryFailedSyncQueue] Re-queued ${failed.length} failed sync item(s).`);
}
