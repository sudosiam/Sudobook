import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banknote } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { StatusPill } from '@/components/common/StatusPill';
import { db } from '@/lib/db';
import { addMoney } from '@/lib/money';

export default function OutstandingPayables() {
  const purchases = useLiveQuery(async () => {
    const rows = await db.purchases.filter((p) => p.status !== 'void' && p.dueAmount > 0).toArray();
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  });

  const totalDue = addMoney(...(purchases ?? []).map((p) => p.dueAmount));

  return (
    <>
      <TopBar title="Pay Vendors" />
      <PageContainer>
        {!purchases ? (
          <LoadingSpinner />
        ) : purchases.length === 0 ? (
          <EmptyState icon={Banknote} title="Nothing to pay" />
        ) : (
          <div className="page-stack">
            <div className="card">
              <p className="text-xs uppercase tracking-wider text-muted">Total Payable</p>
              <MoneyDisplay amount={totalDue} tone="partial" className="mt-1 block hero-money" />
            </div>

            <div className="list-shell">
              {purchases.map((p) => (
                <Link
                  key={p.id}
                  to={`/purchases/${p.id}`}
                  className="flex min-h-[52px] items-center justify-between border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.vendorName}</p>
                    <p className="text-xs text-muted">
                      {p.purchaseNumber} · {p.date}
                    </p>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    <MoneyDisplay amount={p.dueAmount} tone="partial" className="text-sm font-semibold" />
                    <StatusPill status={p.status} />
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
