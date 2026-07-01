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
import { db } from '@/lib/db';
import { getCustomerBalance } from '@/lib/reports';

export default function CustomersList() {
  const location = useLocation();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const state = location.state as { openNew?: boolean } | null;
    if (state?.openNew) {
      setOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const rows = useLiveQuery(async () => {
    const customers = await db.customers.filter((c) => c.isActive).toArray();
    await db.sales.count();
    return Promise.all(
      customers.map(async (c) => ({ ...c, balance: await getCustomerBalance(c.id) })),
    );
  });

  const filtered = (rows ?? []).filter(
    (c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q),
  );

  return (
    <>
      <TopBar title="Customers" />
      <PageContainer>
        <div className="mb-3">
          <SearchBar value={q} onChange={setQ} placeholder="Search customers…" />
        </div>
        {!rows ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" description="Add customers to track receivables." />
        ) : (
          <div className="list-shell">
            {filtered.map((c) => (
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
                  <MoneyDisplay amount={c.balance} className="text-sm font-semibold" tone={c.balance > 0 ? 'income' : 'neutral'} />
                  <p className="text-xs text-muted">{c.balance > 0 ? 'owes you' : 'settled'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>

      <FAB onClick={() => setOpen(true)} label="New customer" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Customer">
        <CustomerForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
