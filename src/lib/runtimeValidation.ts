import { db, type BankAccount } from '@/lib/db';

/** ISO calendar date YYYY-MM-DD */
export function assertIsoDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Date must be YYYY-MM-DD');
  }
}

/** Positive integer paise (≥ 1). */
export function assertPositivePaise(amount: number, label = 'Amount'): void {
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error(`${label} must be greater than zero`);
  }
}

/** Expense accounts 502–599 (excludes COGS 501). */
export function assertExpenseAccountCode(code: number): void {
  if (!Number.isInteger(code) || code < 502 || code > 599) {
    throw new Error('Account must be an expense account (502–599)');
  }
}

/** Income accounts 402–499. */
export function assertIncomeAccountCode(code: number): void {
  if (!Number.isInteger(code) || code < 402 || code > 499) {
    throw new Error('Account must be an income account (402–499)');
  }
}

export async function resolveExpensePaymentBank(
  paidFrom: 'cash' | 'bank',
  bankAccountId: string | undefined,
  defaultCashBankId: () => Promise<string>,
): Promise<BankAccount> {
  if (paidFrom === 'bank') {
    if (!bankAccountId) throw new Error('Bank account required for bank payment');
    const bank = await db.bankAccounts.get(bankAccountId);
    if (!bank?.isActive) throw new Error('Bank account not found');
    return bank;
  }
  const cashId = await defaultCashBankId();
  const bank = await db.bankAccounts.get(cashId);
  if (!bank?.isActive) throw new Error('Cash account not found');
  return bank;
}

export async function assertActiveBankAccount(id: string): Promise<BankAccount> {
  const bank = await db.bankAccounts.get(id);
  if (!bank?.isActive) throw new Error('Bank account not found');
  return bank;
}
