import { db, now, uuid, type RecurringExpense } from '@/lib/db';
import { recordExpense } from '@/lib/transactions';
import { enqueueSync } from '@/lib/sync';

import { recurringExpenseSchema } from '@/lib/validators';

export type RecurringExpenseInput = Omit<
  RecurringExpense,
  'id' | 'isActive' | 'lastPostedMonth' | 'createdAt' | 'updatedAt' | 'syncedAt'
>;

/** Build YYYY-MM expense date for a recurring template in a given month key. */
function expenseDateForMonth(dayOfMonth: number, monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const day = Math.min(dayOfMonth, 28);
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function createRecurringExpense(input: RecurringExpenseInput): Promise<string> {
  recurringExpenseSchema.parse(input);
  const id = uuid();
  const row: RecurringExpense = {
    ...input,
    id,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.transaction('rw', [db.recurringExpenses, db.syncQueue], async () => {
    await db.recurringExpenses.add(row);
    await enqueueSync('recurring_expenses', 'create', id, row);
  });
  return id;
}

export async function deactivateRecurringExpense(id: string): Promise<void> {
  await db.transaction('rw', [db.recurringExpenses, db.syncQueue], async () => {
    await db.recurringExpenses.update(id, { isActive: false, updatedAt: now() });
    const updated = await db.recurringExpenses.get(id);
    if (updated) await enqueueSync('recurring_expenses', 'update', id, updated);
  });
}

/** Post one recurring expense for a specific month if not already posted. */
export async function postRecurringForMonth(
  recurring: RecurringExpense,
  monthKey: string,
): Promise<string | null> {
  if (!recurring.isActive) return null;

  // Atomic check-and-set: claim the month FIRST so two concurrent runs (timer,
  // focus event, manual tap) can't both post the same recurring expense.
  let claimed = false;
  let prev: string | undefined;
  await db.transaction('rw', [db.recurringExpenses, db.syncQueue], async () => {
    const fresh = await db.recurringExpenses.get(recurring.id);
    if (!fresh || !fresh.isActive) return;
    if (fresh.lastPostedMonth && fresh.lastPostedMonth >= monthKey) return;
    prev = fresh.lastPostedMonth;
    await db.recurringExpenses.update(recurring.id, {
      lastPostedMonth: monthKey,
      updatedAt: now(),
    });
    const updated = await db.recurringExpenses.get(recurring.id);
    if (updated) await enqueueSync('recurring_expenses', 'update', recurring.id, updated);
    claimed = true;
  });

  if (!claimed) return null;

  try {
    const date = expenseDateForMonth(recurring.dayOfMonth, monthKey);
    return await recordExpense({
      date,
      accountCode: recurring.accountCode,
      category: recurring.category,
      description: `${recurring.description} (${recurring.name})`,
      amount: recurring.amount,
      paidFrom: recurring.paidFrom,
      bankAccountId: recurring.bankAccountId,
      recurringExpenseId: recurring.id,
    });
  } catch (err) {
    // Posting failed — release the claim so it can be retried later.
    await db.transaction('rw', [db.recurringExpenses, db.syncQueue], async () => {
      await db.recurringExpenses.update(recurring.id, {
        lastPostedMonth: prev,
        updatedAt: now(),
      });
      const updated = await db.recurringExpenses.get(recurring.id);
      if (updated) await enqueueSync('recurring_expenses', 'update', recurring.id, updated);
    });
    throw err;
  }
}

/** Post all active recurring expenses due for the current month. */
export async function postDueRecurringExpenses(): Promise<number> {
  const monthKey = currentMonthKey();
  const templates = await db.recurringExpenses.filter((r) => r.isActive).toArray();
  let count = 0;
  for (const t of templates) {
    const id = await postRecurringForMonth(t, monthKey);
    if (id) count += 1;
  }
  return count;
}
