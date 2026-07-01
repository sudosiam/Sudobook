import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeftRight, PenLine, Plus, Wallet } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Field';
import { BankAccountForm } from '@/components/forms/BankAccountForm';
import { db } from '@/lib/db';
import { getBankBalance } from '@/lib/reports';
import { addMoney } from '@/lib/money';

export default function BankingOverview() {
  const [addOpen, setAddOpen] = useState(false);

  const rows = useLiveQuery(async () => {
    const banks = await db.bankAccounts.where('isActive').equals(1).toArray();
    await db.bankTransactions.count();
    return Promise.all(banks.map(async (b) => ({ ...b, balance: await getBankBalance(b.id) })));
  });

  const total = addMoney(...(rows ?? []).map((r) => r.balance));

  return (
    <>
      <TopBar title="Banking" />
      <PageContainer>
        <div className="mb-3 card">
          <p className="text-xs uppercase tracking-wider text-muted">Total Balance</p>
          <MoneyDisplay amount={total} className="mt-1 block hero-money" />
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <Button variant="secondary" className="flex-col gap-1 px-2 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="h-5 w-5" /> Account
          </Button>
          <Link
            to="/banking/transfer"
            className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border border-border-app bg-surface px-2 text-xs font-medium text-foreground active:bg-surface-hover"
          >
            <ArrowLeftRight className="h-5 w-5" /> Transfer
          </Link>
          <Link
            to="/banking/manual-entry"
            className="flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl border border-border-app bg-surface px-2 text-xs font-medium text-foreground active:bg-surface-hover"
          >
            <PenLine className="h-5 w-5" /> Manual Entry
          </Link>
        </div>

        {!rows ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyState icon={Wallet} title="No accounts yet" description="Add a bank or cash account." />
        ) : (
          <div className="space-y-2">
            {rows.map((b) => (
              <Link
                key={b.id}
                to={`/banking/${b.id}`}
                className="flex min-h-[52px] items-center justify-between rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{b.name}</p>
                  <p className="mt-0.5 text-xs capitalize text-muted">
                    {b.bankName} · {b.accountType}
                  </p>
                </div>
                <MoneyDisplay amount={b.balance} className="ml-3 text-sm font-semibold" />
              </Link>
            ))}
          </div>
        )}
      </PageContainer>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Account">
        <BankAccountForm onDone={() => setAddOpen(false)} />
      </Modal>
    </>
  );
}
