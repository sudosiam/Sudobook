import type { AccountType, NormalBalance, Account } from '@/lib/db';

export interface AccountSeed {
  code: number;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode?: number;
}

/** Account code range → account type mapping (single source of truth). */
export function typeForCode(code: number): AccountType {
  if (code >= 100 && code < 200) return 'asset';
  if (code >= 200 && code < 300) return 'liability';
  if (code >= 300 && code < 400) return 'equity';
  if (code >= 400 && code < 500) return 'income';
  return 'expense';
}

/** Debit-normal for assets & expenses; credit-normal for the rest. */
export function normalBalanceForType(type: AccountType): NormalBalance {
  return type === 'asset' || type === 'expense' ? 'debit' : 'credit';
}

/** Well-known account codes referenced by the accounting engine. */
export const CODES = {
  CASH: 101,
  BANK: 102,
  RECEIVABLE: 103,
  INVENTORY: 104,
  FIXED_ASSETS: 105,
  PAYABLE: 201,
  LOANS: 202,
  CAPITAL: 301,
  RETAINED_EARNINGS: 302,
  PRODUCT_SALES: 401,
  OTHER_INCOME: 402,
  COGS: 501,
  RENT: 502,
  SALARIES: 503,
  ELECTRICITY: 504,
  MARKETING: 505,
  BANK_CHARGES: 506,
  MISC: 507,
} as const;

export const DEFAULT_ACCOUNTS: AccountSeed[] = [
  // Assets
  { code: 101, name: 'Cash in Hand', type: 'asset', normalBalance: 'debit' },
  { code: 102, name: 'Bank Accounts', type: 'asset', normalBalance: 'debit' },
  { code: 103, name: 'Accounts Receivable', type: 'asset', normalBalance: 'debit' },
  { code: 104, name: 'Inventory', type: 'asset', normalBalance: 'debit' },
  { code: 105, name: 'Fixed Assets', type: 'asset', normalBalance: 'debit' },
  // Liabilities
  { code: 201, name: 'Accounts Payable', type: 'liability', normalBalance: 'credit' },
  { code: 202, name: 'Loans', type: 'liability', normalBalance: 'credit' },
  { code: 203, name: 'Credit Cards', type: 'liability', normalBalance: 'credit' },
  // Equity
  { code: 301, name: "Owner's Capital", type: 'equity', normalBalance: 'credit' },
  { code: 302, name: 'Retained Earnings', type: 'equity', normalBalance: 'credit' },
  // Income
  { code: 401, name: 'Product Sales', type: 'income', normalBalance: 'credit' },
  { code: 402, name: 'Other Income', type: 'income', normalBalance: 'credit' },
  // Expenses
  { code: 501, name: 'Cost of Goods Sold', type: 'expense', normalBalance: 'debit' },
  { code: 502, name: 'Rent', type: 'expense', normalBalance: 'debit' },
  { code: 503, name: 'Salaries', type: 'expense', normalBalance: 'debit' },
  { code: 504, name: 'Electricity', type: 'expense', normalBalance: 'debit' },
  { code: 505, name: 'Marketing', type: 'expense', normalBalance: 'debit' },
  { code: 506, name: 'Bank Charges', type: 'expense', normalBalance: 'debit' },
  { code: 507, name: 'Miscellaneous Expenses', type: 'expense', normalBalance: 'debit' },
];

/**
 * Deterministic UUID for a core account code so that every device seeds the
 * exact same primary key. This lets seeded rows sync/merge cleanly across
 * devices instead of creating duplicate accounts with random ids.
 */
export function accountUuid(code: number): string {
  const tail = String(code).padStart(12, '0');
  return `0acc0000-0000-4000-8000-${tail}`;
}

/** Cash drawer as a "bank account" of type cash — deterministic id so it is the same record on every device. */
export const CASH_DRAWER_ID = '0cca0000-0000-4000-8000-000000000000';

/** Manual expense picker: active operating expenses (502–599), excludes COGS (501). */
export function isSelectableExpenseAccount(
  a: Pick<Account, 'type' | 'code' | 'isActive'>,
): boolean {
  return a.isActive && a.type === 'expense' && a.code >= 502 && a.code < 600;
}

/** Other income picker: active income accounts (402–499), excludes Product Sales (401). */
export function isSelectableIncomeAccount(
  a: Pick<Account, 'type' | 'code' | 'isActive'>,
): boolean {
  return a.isActive && a.type === 'income' && a.code >= 402 && a.code < 500;
}

export function sortAccountsByCode(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => a.code - b.code);
}
