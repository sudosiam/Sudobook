import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ShoppingCart } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { FAB } from '@/components/common/FAB';
import { MoneyDisplay, moneyToneForStatus } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { StatusPill } from '@/components/common/StatusPill';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { db } from '@/lib/db';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';

const PAGE_SIZE = 100;

export default function PurchasesList() {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const purchases = useLiveQuery(
    () =>
      range
        ? db.purchases.where('date').between(range.start, range.end, true, true).reverse().toArray()
        : db.purchases.orderBy('date').reverse().limit(limit).toArray(),
    [range?.start, range?.end, limit],
  );

  const filtered = (purchases ?? []).filter(
    (p) =>
      p.vendorName.toLowerCase().includes(q.toLowerCase()) ||
      p.purchaseNumber.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <TopBar title="Purchases" right={<PeriodFilter placement="header" />} />
      <PageContainer>
        <div className="filter-toolbar">
          <SearchBar value={q} onChange={setQ} placeholder="Search purchases…" />
        </div>
        {!purchases ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title={(purchases?.length ?? 0) === 0 ? 'No purchases yet' : 'No matching purchases'}
            description={
              (purchases?.length ?? 0) === 0
                ? 'Record stock you buy from vendors.'
                : 'Try adjusting search.'
            }
          />
        ) : (
          <div className="list-shell">
            {filtered.map((p) => (
              <Link
                key={p.id}
                to={`/purchases/${p.id}`}
                className="flex min-h-[52px] items-center justify-between border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{p.vendorName}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {p.purchaseNumber} · {p.date}
                  </p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-1">
                  <MoneyDisplay
                    amount={p.total}
                    className="text-sm font-semibold"
                    tone={moneyToneForStatus(p.status, p.paymentMethod)}
                  />
                  <StatusPill status={p.status} />
                </div>
              </Link>
            ))}
            {!range && (purchases?.length ?? 0) >= limit && (
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
      <FAB to="/purchases/new" label="New purchase" />
    </>
  );
}
