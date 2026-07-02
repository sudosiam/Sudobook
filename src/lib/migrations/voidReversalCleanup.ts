import { db, now, type JournalEntry } from '@/lib/db';

export const VOID_REVERSAL_CLEANUP_MIGRATION = 'void-reversal-cleanup-v1';

export interface VoidReversalCleanupPreview {
  orphanedReversals: JournalEntry[];
}

export interface VoidReversalCleanupResult {
  voidedCount: number;
  voidedIds: string[];
}

/**
 * Find posted mirror-reversal journal entries left by the pre-fix void flow.
 *
 * Old `voidJournalEntryTx` both marked the original `void` (excluded from balances)
 * and posted a reversal with `reversalOf` set. Balances only sum `posted` rows,
 * so those orphan reversals over-correct ledger balances.
 */
export async function findOrphanedVoidReversals(): Promise<JournalEntry[]> {
  const all = await db.journalEntries.toArray();
  const byId = new Map(all.map((e) => [e.id, e]));

  return all.filter((rev) => {
    if (!rev.reversalOf || rev.status !== 'posted') return false;
    const original = byId.get(rev.reversalOf);
    return !original || original.status === 'void';
  });
}

export async function previewVoidReversalCleanup(): Promise<VoidReversalCleanupPreview> {
  const orphanedReversals = await findOrphanedVoidReversals();
  return { orphanedReversals };
}

/**
 * Void orphan reversal entries so balances match the fixed void semantics.
 * Idempotent — safe to run multiple times.
 */
export async function repairVoidDoubleReversals(): Promise<VoidReversalCleanupResult> {
  const orphans = await findOrphanedVoidReversals();
  if (orphans.length === 0) {
    return { voidedCount: 0, voidedIds: [] };
  }

  const voidedIds: string[] = [];

  await db.transaction('rw', db.journalEntries, async () => {
    for (const rev of orphans) {
      const fresh = await db.journalEntries.get(rev.id);
      if (!fresh || fresh.status !== 'posted' || !fresh.reversalOf) continue;

      const original = await db.journalEntries.get(fresh.reversalOf);
      if (original && original.status !== 'void') continue;

      await db.journalEntries.update(rev.id, { status: 'void', updatedAt: now() });
      const updated = await db.journalEntries.get(rev.id);
      if (updated) {
        voidedIds.push(rev.id);
      }
    }
  });

  if (voidedIds.length > 0) {
    console.info(
      `[voidReversalCleanup] Voided ${voidedIds.length} orphan reversal journal entr${voidedIds.length === 1 ? 'y' : 'ies'}`,
    );
  }

  return { voidedCount: voidedIds.length, voidedIds };
}

/** One-time migration hook — runs via `runMigrations()` on app bootstrap. */
export async function migrateVoidDoubleReversals(): Promise<VoidReversalCleanupResult> {
  return repairVoidDoubleReversals();
}
