import { db, now, type Account, type BankAccount } from '@/lib/db';
import { DEFAULT_ACCOUNTS, CODES, accountUuid, CASH_DRAWER_ID } from '@/lib/coa';

export const DET_IDS_MIGRATION = 'det-ids-v1';

/**
 * Re-key accounts and the cash drawer to deterministic ids and remap all
 * references, so this device matches every other device (and the cloud).
 */
export async function migrateDeterministicIds(): Promise<void> {
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
    ],
    async () => {
      const accounts = await db.accounts.toArray();
      for (const acc of accounts) {
        const canonical = accountUuid(acc.code);
        if (acc.id === canonical) continue;
        await db.accounts.delete(acc.id);
        const fixed = { ...acc, id: canonical, updatedAt: now() };
        await db.accounts.put(fixed);
      }

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
        }
      }

      const banks = await db.bankAccounts.toArray();
      const cashDrawer = banks.find((b) => b.accountType === 'cash');
      if (cashDrawer && cashDrawer.id !== CASH_DRAWER_ID) {
        const oldId = cashDrawer.id;
        const remap = async (local: string, _remote: string) => {
          const table = db.table(local);
          const all = (await table.toArray()) as Array<
            Record<string, unknown> & { id: string; bankAccountId?: string }
          >;
          for (const r of all) {
            if (r.bankAccountId !== oldId) continue;
            const fixed = { ...r, bankAccountId: CASH_DRAWER_ID, updatedAt: now() };
            await table.put(fixed);
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

/** Add any new default accounts missing from older installs (idempotent). */
export async function syncMissingDefaultAccounts(): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
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
    }
  });
}
