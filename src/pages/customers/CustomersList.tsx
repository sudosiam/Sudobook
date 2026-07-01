import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Users } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { FAB } from '@/components/common/FAB';
import { CustomerForm } from '@/components/forms/CustomerForm';
import { db, activeWhere, type Customer } from '@/lib/db';
import { getCustomerBalance } from '@/lib/reports';

const PAGE_SIZE = 60;

/** Balance for one page of customers only — avoids scanning sales for every
 * customer up front when the list runs into the thousands. */
function useVisibleBalances(customers: Customer[]) {
  return useLiveQuery(async () => {
    const pairs = await Promise.all(
      customers.map(async (c) => [c.id, await getCustomerBalance(c.id)] as const),
    );
    return new Map(pairs);
  }, [customers.map((c) => c.id).join(',')]);
}

export default function CustomersList() {
  const location = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    const state = location.state as { openNew?: boolean } | null;
    if (state?.openNew) {
      setOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const customers = useLiveQuery(() =>
    activeWhere(db.customers)
      .toArray()
      .then((rows) => rows.sort((a, b) => a.name.localeCompare(b.name))),
  );

  const filtered = (customers ?? []).filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q),
  );
  const visibleRows = filtered.slice(0, visible);
  const balances = useVisibleBalances(visibleRows);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q]);

  return (
    <>
      <TopBar title="Customers" />
      <PageContainer>
        <div className="mb-3">
          <SearchBar value={q} onChange={setQ} placeholder="Search customers…" />
        </div>
        {!customers ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" />
        ) : (
          <>
            <div className="list-shell">
              {visibleRows.map((c) => {
                const balance = balances?.get(c.id) ?? 0;
                return (
                  <Link
                    key={c.id}
                    to={`/customers/${c.id}`}
                    className="flex min-h-[52px] items-center justify-between border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted">{c.phone}</p>
                    </div>
                    <div className="ml-3 text-right">
                      <MoneyDisplay amount={balance} className="text-sm font-semibold" tone={balance > 0 ? 'income' : 'neutral'} />
                    </div>
                  </Link>
                );
              })}
            </div>
            {visible < filtered.length && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="mt-3 w-full rounded-xl border border-border-app/60 py-3 text-center text-sm font-medium text-muted active:bg-surface-hover"
              >
                Load more ({filtered.length - visible} remaining)
              </button>
            )}
          </>
        )}
      </PageContainer>

      <FAB onClick={() => setOpen(true)} label="New customer" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Customer">
        <CustomerForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
