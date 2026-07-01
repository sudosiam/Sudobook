import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Receipt, Repeat } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { FAB } from '@/components/common/FAB';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Button } from '@/components/common/Field';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { RowActionButton } from '@/components/common/EntityActions';
import { db } from '@/lib/db';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';
import { voidExpense } from '@/lib/transactions';
import {
  deactivateRecurringExpense,
  postDueRecurringExpenses,
  postRecurringForMonth,
} from '@/lib/recurring';
import { toast } from '@/store/useToast';

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PAGE_SIZE = 100;

export default function ExpensesList() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [removeRecurringId, setRemoveRecurringId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const monthKey = currentMonthKey();

  const expenses = useLiveQuery(
    () =>
      range
        ? db.expenses.where('date').between(range.start, range.end, true, true).reverse().toArray()
        : db.expenses.orderBy('date').reverse().limit(limit).toArray(),
    [range?.start, range?.end, limit],
  );

  const recurring = useLiveQuery(() => db.recurringExpenses.filter((r) => r.isActive).toArray());

  const filtered = (expenses ?? []).filter(
    (e) =>
      e.description.toLowerCase().includes(q.toLowerCase()) ||
      e.category.toLowerCase().includes(q.toLowerCase()),
  );

  const postAllDue = async () => {
    setBusy(true);
    try {
      const n = await postDueRecurringExpenses();
      toast.success(n > 0 ? `Posted ${n} recurring expense(s)` : 'Nothing due this month');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const postOne = async (id: string) => {
    const template = await db.recurringExpenses.get(id);
    if (!template) return;
    setBusy(true);
    try {
      const expenseId = await postRecurringForMonth(template, monthKey);
      toast.success(expenseId ? 'Expense posted' : 'Already posted this month');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const removeRecurring = async () => {
    if (!removeRecurringId) return;
    try {
      await deactivateRecurringExpense(removeRecurringId);
      toast.success('Template removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setRemoveRecurringId(null);
    }
  };

  const handleVoid = async () => {
    if (!voidId) return;
    try {
      await voidExpense(voidId, 'Voided by user');
      toast.success('Expense voided');
      setVoidId(null);
    } catch (err) {
      console.error('[handleVoid]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to void expense');
    }
  };

  return (
    <>
      <TopBar title="Expenses" right={<PeriodFilter placement="header" />} />
      <PageContainer>
        {(recurring ?? []).length > 0 && (
          <div className="mb-3 card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Recurring</h2>
              <Link to="/expenses/recurring/new" className="text-xs text-brand-light">
                + Add
              </Link>
            </div>
            <div className="mb-3 space-y-2">
              {(recurring ?? []).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-app px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{r.name}</p>
                    <p className="text-xs text-muted">
                      Day {r.dayOfMonth} · {r.category}
                      {r.lastPostedMonth === monthKey && ' · posted'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <MoneyDisplay amount={r.amount} className="text-xs" tone="expense" />
                    <button
                      type="button"
                      disabled={busy || r.lastPostedMonth === monthKey}
                      onClick={() => void postOne(r.id)}
                      className="text-xs text-brand-light disabled:text-disabled"
                    >
                      Post
                    </button>
                    <RowActionButton
                      label="Remove recurring template"
                      onClick={() => setRemoveRecurringId(r.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => void postAllDue()}>
              <Repeat className="h-4 w-4" /> Post All Due This Month
            </Button>
          </div>
        )}

        {(recurring ?? []).length === 0 && (
          <Link
            to="/expenses/recurring/new"
            className="mb-3 flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-dashed border-border-app text-sm text-muted hover:bg-surface"
          >
            <Plus className="h-4 w-4" /> Set up recurring expense
          </Link>
        )}

        <div className="filter-toolbar">
          <SearchBar value={q} onChange={setQ} placeholder="Search expenses…" />
        </div>
        {!expenses ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={(expenses?.length ?? 0) === 0 ? 'No expenses yet' : 'No matching expenses'}
            description={
              (expenses?.length ?? 0) === 0
                ? 'Track rent, salaries, electricity and more.'
                : 'Try adjusting search.'
            }
          />
        ) : (
          <div className="list-shell">
            {filtered.map((e) => (
              <div
                key={e.id}
                className="flex min-h-[52px] items-center justify-between gap-2 border-b border-border-app px-3 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-medium ${e.voidedAt ? 'text-muted line-through' : 'text-foreground'}`}
                  >
                    {e.description}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {e.category} · {e.date}
                    {e.recurringExpenseId && ' · recurring'}
                    {e.voidedAt && ' · voided'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <MoneyDisplay amount={e.amount} className="text-sm font-semibold" tone="expense" />
                  {!e.voidedAt && (
                    <RowActionButton label="Void expense" onClick={() => setVoidId(e.id)} />
                  )}
                </div>
              </div>
            ))}
            {!range && (expenses?.length ?? 0) >= limit && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="w-full min-h-[48px] border-t border-border-app/35 py-3 text-sm font-medium text-brand-light active:bg-surface-hover"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </PageContainer>
      <FAB to="/expenses/new" label="New expense" />

      <ConfirmDialog
        open={voidId !== null}
        title="Void this expense?"
        message="This posts a reversing entry and refunds the bank/cash account. The record is kept for audit."
        confirmLabel="Void"
        danger
        onConfirm={handleVoid}
        onCancel={() => setVoidId(null)}
      />

      <ConfirmDialog
        open={removeRecurringId !== null}
        title="Remove recurring template?"
        message="Future months will no longer auto-post this expense. Already posted expenses are kept."
        confirmLabel="Remove"
        danger
        onConfirm={removeRecurring}
        onCancel={() => setRemoveRecurringId(null)}
      />
    </>
  );
}
