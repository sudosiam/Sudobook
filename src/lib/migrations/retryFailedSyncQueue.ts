import { db } from '@/lib/db';
import { isValidSyncRecordId } from '@/lib/syncIds';

export const RETRY_FAILED_SYNC_MIGRATION = 'retry-failed-sync-v1';

/**
 * Cloud sync items that hit missing tables / RLS gaps were marked `failed`
 * after 3 retries. Reset transient failures only — skip permanent uuid errors.
 */
export async function retryFailedSyncQueue(): Promise<void> {
  const failed = await db.syncQueue.where('status').equals('failed').toArray();
  if (failed.length === 0) return;

  let requeued = 0;
  await db.transaction('rw', db.syncQueue, async () => {
    for (const item of failed) {
      if (!isValidSyncRecordId(item.recordId)) continue;
      await db.syncQueue.update(item.id, { status: 'pending', retryCount: 0 });
      requeued += 1;
    }
  });

  if (requeued > 0) {
    console.info(`[retryFailedSyncQueue] Re-queued ${requeued} failed sync item(s).`);
  }
}
