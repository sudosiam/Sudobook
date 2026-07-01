import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Truck } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { FAB } from '@/components/common/FAB';
import { VendorForm } from '@/components/forms/VendorForm';
import { db } from '@/lib/db';
import { getVendorBalance } from '@/lib/reports';

export default function VendorsList() {
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
    const vendors = await db.vendors.filter((v) => v.isActive).toArray();
    await db.purchases.count();
    return Promise.all(vendors.map(async (v) => ({ ...v, balance: await getVendorBalance(v.id) })));
  });

  const filtered = (rows ?? []).filter(
    (v) => v.name.toLowerCase().includes(q.toLowerCase()) || v.phone.includes(q),
  );

  return (
    <>
      <TopBar title="Vendors" />
      <PageContainer>
        <div className="mb-3">
          <SearchBar value={q} onChange={setQ} placeholder="Search vendors…" />
        </div>
        {!rows ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Truck} title="No vendors yet" description="Add vendors to track payables." />
        ) : (
          <div className="list-shell">
            {filtered.map((v) => (
              <Link
                key={v.id}
                to={`/vendors/${v.id}`}
                className="flex min-h-[52px] items-center justify-between border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{v.company || v.phone}</p>
                </div>
                <div className="ml-3 text-right">
                  <MoneyDisplay amount={v.balance} className="text-sm font-semibold" tone={v.balance > 0 ? 'expense' : 'neutral'} />
                  <p className="text-xs text-muted">{v.balance > 0 ? 'you owe' : 'settled'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </PageContainer>

      <FAB onClick={() => setOpen(true)} label="New vendor" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Vendor">
        <VendorForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
