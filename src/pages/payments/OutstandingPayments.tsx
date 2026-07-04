import { Link } from 'react-router-dom';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { HandCoins } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { StatusPill } from '@/components/common/StatusPill';
import { db } from '@/lib/db';
import { addMoney } from '@/lib/money';

export default function OutstandingPayments() {
  const sales = useLiveQuery(async () => {
    const rows = await db.sales.filter((s) => s.status !== 'void' && s.dueAmount > 0).toArray();
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  });

  const totalDue = addMoney(...(sales ?? []).map((s) => s.dueAmount));

  return (
    <>
      <TopBar title="Collect Payment" />
      <PageContainer>
        {!sales ? (
          <LoadingSpinner />
        ) : sales.length === 0 ? (
          <EmptyState icon={HandCoins} title="Nothing to collect" />
        ) : (
          <div className="page-stack">
            <div className="card">
              <p className="text-xs uppercase tracking-wider text-muted">Total Outstanding</p>
              <MoneyDisplay amount={totalDue} tone="partial" className="mt-1 block hero-money" />
            </div>

            <div className="list-shell">
              {sales.map((s) => (
                <Link
                  key={s.id}
                  to={`/sales/${s.id}`}
                  className="flex min-h-[52px] items-center justify-between border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{s.customerName}</p>
                    <p className="text-xs text-muted">
                      {s.saleNumber} · {s.date}
                    </p>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    <MoneyDisplay amount={s.dueAmount} tone="partial" className="text-sm font-semibold" />
                    <StatusPill status={s.status} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}
