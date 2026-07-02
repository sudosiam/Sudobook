import { db, now, uuid, type Account } from '@/lib/db';
import { CODES, sortAccountsByCode } from '@/lib/coa';
import { invalidateCodeToIdMap } from '@/lib/transactions';

/** Built-in operating expense accounts — cannot be deleted. */
export const DEFAULT_EXPENSE_ACCOUNT_CODES = new Set<number>([
  CODES.COGS,
  CODES.RENT,
  CODES.SALARIES,
  CODES.ELECTRICITY,
  CODES.MARKETING,
  CODES.BANK_CHARGES,
  CODES.MISC,
]);

export const CUSTOM_EXPENSE_CODE_MIN = 508;
export const CUSTOM_EXPENSE_CODE_MAX = 599;

export function isDefaultExpenseAccount(code: number): boolean {
  return DEFAULT_EXPENSE_ACCOUNT_CODES.has(code);
}

export function isCustomExpenseAccount(code: number): boolean {
  return code >= CUSTOM_EXPENSE_CODE_MIN && code <= CUSTOM_EXPENSE_CODE_MAX;
}

/** Operating expense accounts for pickers and category management (502–599, excludes COGS). */
export async function listExpenseCategoryAccounts(): Promise<Account[]> {
  const all = await db.accounts.toArray();
  return sortAccountsByCode(
    all.filter(
      (a) =>
        a.isActive &&
        a.type === 'expense' &&
        a.code >= CODES.RENT &&
        a.code <= CUSTOM_EXPENSE_CODE_MAX,
    ),
  );
}

async function nextCustomExpenseCode(): Promise<number> {
  const used = new Set(
    (await db.accounts.where('type').equals('expense').toArray()).map((a) => a.code),
  );
  for (let code = CUSTOM_EXPENSE_CODE_MIN; code <= CUSTOM_EXPENSE_CODE_MAX; code++) {
    if (!used.has(code)) return code;
  }
  throw new Error('Maximum custom expense categories reached (508–599 full)');
}

export async function createExpenseCategory(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name required');

  let id = '';
  await db.transaction('rw', db.accounts, async () => {
    const dupe = await db.accounts
      .filter(
        (a) =>
          a.type === 'expense' &&
          a.isActive &&
          a.name.toLowerCase() === trimmed.toLowerCase(),
      )
      .first();
    if (dupe) throw new Error(`Category "${trimmed}" already exists`);

    const code = await nextCustomExpenseCode();
    id = uuid();
    const account: Account = {
      id,
      code,
      name: trimmed,
      type: 'expense',
      normalBalance: 'debit',
      isActive: true,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.accounts.add(account);
  });

  invalidateCodeToIdMap();
  return id;
}

export async function updateExpenseCategory(
  id: string,
  patch: Partial<Pick<Account, 'name' | 'isActive'>>,
): Promise<void> {
  await db.transaction('rw', db.accounts, async () => {
    const acc = await db.accounts.get(id);
    if (!acc || acc.type !== 'expense') throw new Error('Category not found');
    if (isDefaultExpenseAccount(acc.code) && patch.isActive === false) {
      throw new Error('Default expense categories cannot be removed');
    }

    if (patch.name != null) {
      const trimmed = patch.name.trim();
      if (!trimmed) throw new Error('Category name required');
      const dupe = await db.accounts
        .filter(
          (a) =>
            a.id !== id &&
            a.type === 'expense' &&
            a.isActive &&
            a.name.toLowerCase() === trimmed.toLowerCase(),
        )
        .first();
      if (dupe) throw new Error(`Category "${trimmed}" already exists`);
      patch = { ...patch, name: trimmed };
    }

    await db.accounts.update(id, { ...patch, updatedAt: now() });
  });

  invalidateCodeToIdMap();
}
