import { db, now, type Account, type AppSettings, type BankAccount } from '@/lib/db';
import { DEFAULT_ACCOUNTS, CODES, accountUuid, CASH_DRAWER_ID } from '@/lib/coa';
import { syncDefaultCategories } from '@/lib/categories';
import { getCurrentFY } from '@/lib/sequences';
import { enqueueSync } from '@/lib/sync';
import {
  VOID_REVERSAL_CLEANUP_MIGRATION,
  migrateVoidDoubleReversals,
} from '@/lib/migrations/voidReversalCleanup';
import {
  CATEGORY_SLUG_MIGRATION,
  migrateCategorySlugIds,
} from '@/lib/migrations/categorySlugToUuid';

/** Short random per-device code (e.g. "A3") used to keep document numbers unique across devices. */
function makeDeviceId(): string {
  return Math.floor(Math.random() * 36 * 36)
    .toString(36)
    .padStart(2, '0')
    .toUpperCase();
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

      // Cash drawer as a "bank account" of type cash — deterministic id so it
      // is the same record on every device (referenced by sales/expenses/etc).
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
        businessName: 'Biswajit Power Hub',
        currentFY: getCurrentFY(),
        fyStartMonth: 4,
        cashAccountId,
        defaultBankId: cashDrawer.id,
        currency: 'INR',
        deviceId: makeDeviceId(),
        migrations: ['det-ids-v1'],
        saleSequence: 0,
        purchaseSequence: 0,
        expenseSequence: 0,
        seeded: true,
      };
      await db.settings.put(settings);
    },
  );
}

/**
 * One-time migrations for devices seeded before deterministic ids existed.
 * Each migration is guarded by a token in settings.migrations so it runs once.
 */
export async function runMigrations(): Promise<void> {
  const settings = await db.settings.get('singleton');
  if (!settings) return;
  const done = new Set(settings.migrations ?? []);

  if (!settings.deviceId) {
    await db.settings.update('singleton', { deviceId: makeDeviceId() });
  }

  if (!done.has('det-ids-v1')) {
    await migrateDeterministicIds();
    const s = await db.settings.get('singleton');
    const migrations = new Set(s?.migrations ?? []);
    migrations.add('det-ids-v1');
    await db.settings.update('singleton', { migrations: [...migrations] });
  }

  if (!done.has(VOID_REVERSAL_CLEANUP_MIGRATION)) {
    await migrateVoidDoubleReversals();
    const s = await db.settings.get('singleton');
    const migrations = new Set(s?.migrations ?? []);
    migrations.add(VOID_REVERSAL_CLEANUP_MIGRATION);
    await db.settings.update('singleton', { migrations: [...migrations] });
  }

  if (!done.has(CATEGORY_SLUG_MIGRATION)) {
    await migrateCategorySlugIds();
  }

  await syncMissingDefaultAccounts();
  await syncDefaultCategories();
}

/** Add any new default accounts missing from older installs (idempotent). */
async function syncMissingDefaultAccounts(): Promise<void> {
  await db.transaction('rw', db.accounts, db.syncQueue, async () => {
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
  });
}

/**
 * Re-key accounts and the cash drawer to deterministic ids and remap all
 * references, so this device matches every other device (and the cloud).
 */
async function migrateDeterministicIds(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.accounts,
      db.bankAccounts,
      db.journalEntries,
      db.sales,
      db.purchases,
      db.expenses,
      db.bankTransactions,
      db.settings,
      db.syncQueue,
    ],
    async () => {
      // 1. Accounts → deterministic ids keyed by code.
      const accounts = await db.accounts.toArray();
      for (const acc of accounts) {
        const canonical = accountUuid(acc.code);
        if (acc.id === canonical) continue;
        await db.accounts.delete(acc.id);
        const fixed = { ...acc, id: canonical, updatedAt: now() };
        await db.accounts.put(fixed);
        await enqueueSync('accounts', 'update', fixed.id, fixed);
      }

      // Journal line accountIds are cosmetic (reports key off accountCode), but
      // realign them for cleanliness.
      const entries = await db.journalEntries.toArray();
      for (const e of entries) {
        let changed = false;
        const lines = e.lines.map((l) => {
          const canonical = accountUuid(l.accountCode);
          if (l.accountId !== canonical) changed = true;
          return { ...l, accountId: canonical };
        });
        if (changed) {
          const fixed = { ...e, lines, updatedAt: now() };
          await db.journalEntries.put(fixed);
          await enqueueSync('journal_entries', 'update', fixed.id, fixed);
        }
      }

      // 2. Cash drawer → deterministic id, remap every reference to it.
      // accountType isn't indexed, so scan (there are only a handful of banks).
      const banks = await db.bankAccounts.toArray();
      const cashDrawer = banks.find((b) => b.accountType === 'cash');
      if (cashDrawer && cashDrawer.id !== CASH_DRAWER_ID) {
        const oldId = cashDrawer.id;
        const remap = async (local: string, remote: string) => {
          const table = db.table(local);
          // bankAccountId isn't indexed on most of these tables, so scan.
          const all = (await table.toArray()) as Array<
            Record<string, unknown> & { id: string; bankAccountId?: string }
          >;
          for (const r of all) {
            if (r.bankAccountId !== oldId) continue;
            const fixed = { ...r, bankAccountId: CASH_DRAWER_ID, updatedAt: now() };
            await table.put(fixed);
            await enqueueSync(remote, 'update', fixed.id, fixed);
          }
        };
        await remap('sales', 'sales');
        await remap('purchases', 'purchases');
        await remap('expenses', 'expenses');
        await remap('bankTransactions', 'bank_transactions');

        await db.bankAccounts.delete(oldId);
        const fixed: BankAccount = {
          ...cashDrawer,
          id: CASH_DRAWER_ID,
          accountId: accountUuid(CODES.CASH),
          updatedAt: now(),
        };
        await db.bankAccounts.put(fixed);
        await enqueueSync('bank_accounts', 'update', fixed.id, fixed);

        const s = await db.settings.get('singleton');
        if (s?.defaultBankId === oldId) {
          await db.settings.update('singleton', { defaultBankId: CASH_DRAWER_ID });
        }
      }

      await db.settings.update('singleton', {
        cashAccountId: accountUuid(CODES.CASH),
      });
    },
  );
}
