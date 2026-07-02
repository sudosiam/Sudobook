import { db, now, type Account, type AppSettings, type BankAccount } from '@/lib/db';
import { DEFAULT_ACCOUNTS, CODES, accountUuid, CASH_DRAWER_ID } from '@/lib/coa';
import { syncDefaultCategories } from '@/lib/categories';
import { getCurrentFY } from '@/lib/sequences';
import { enqueueSync } from '@/lib/sync';
import { INITIAL_MIGRATION_TOKENS, runMigrations } from '@/lib/migrations/runner';

/** Short random per-device code (e.g. "A3F9") keeps document numbers unique across devices. */
function makeDeviceId(): string {
  const n = Math.floor(Math.random() * 36 ** 4);
  return n.toString(36).padStart(4, '0').toUpperCase();
}

/**
 * Idempotently seed the local database on first run: chart of accounts,
 * a default cash bank account, and the singleton settings row.
 *
 * Seeded rows use DETERMINISTIC ids (see coa.ts) so every device produces the
 * exact same primary keys. They are also enqueued for sync so the cloud has a
 * canonical copy and a brand-new device merges cleanly instead of duplicating.
 */
export async function seedDatabase(): Promise<void> {
  const existing = await db.settings.get('singleton');
  if (existing?.seeded) {
    await runMigrations();
    return;
  }

  await db.transaction(
    'rw',
    db.accounts,
    db.bankAccounts,
    db.productCategories,
    db.settings,
    db.syncQueue,
    async () => {
      for (const seed of DEFAULT_ACCOUNTS) {
        const already = await db.accounts.where('code').equals(seed.code).first();
        if (already) continue;
        const account: Account = {
          id: accountUuid(seed.code),
          code: seed.code,
          name: seed.name,
          type: seed.type,
          normalBalance: seed.normalBalance,
          parentCode: seed.parentCode,
          isActive: true,
          createdAt: now(),
          updatedAt: now(),
        };
        await db.accounts.add(account);
        await enqueueSync('accounts', 'create', account.id, account);
      }

      await syncDefaultCategories();

      const cashAccountId = accountUuid(CODES.CASH);

      let cashDrawer = await db.bankAccounts.get(CASH_DRAWER_ID);
      if (!cashDrawer) {
        cashDrawer = {
          id: CASH_DRAWER_ID,
          accountId: cashAccountId,
          name: 'Cash in Hand',
          bankName: 'Cash',
          accountNumber: '----',
          accountType: 'cash',
          openingBalance: 0,
          isActive: true,
          createdAt: now(),
          updatedAt: now(),
        } satisfies BankAccount;
        await db.bankAccounts.add(cashDrawer);
        await enqueueSync('bank_accounts', 'create', cashDrawer.id, cashDrawer);
      }

      const settings: AppSettings = {
        id: 'singleton',
        businessName: '',
        currentFY: getCurrentFY(),
        fyStartMonth: 4,
        cashAccountId,
        defaultBankId: cashDrawer.id,
        currency: 'INR',
        deviceId: makeDeviceId(),
        migrations: [...INITIAL_MIGRATION_TOKENS],
        saleSequence: 0,
        purchaseSequence: 0,
        expenseSequence: 0,
        seeded: true,
      };
      await db.settings.put(settings);
    },
  );

  await runMigrations();
}

export { runMigrations } from '@/lib/migrations/runner';
