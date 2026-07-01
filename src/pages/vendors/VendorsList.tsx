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
import { db, activeWhere, type Vendor } from '@/lib/db';
import { getVendorBalance } from '@/lib/reports';

const PAGE_SIZE = 60;

/** Balance for one page of vendors only — avoids scanning purchases for every
 * vendor up front when the list runs into the thousands. */
function useVisibleBalances(vendors: Vendor[]) {
  return useLiveQuery(async () => {
    const pairs = await Promise.all(
      vendors.map(async (v) => [v.id, await getVendorBalance(v.id)] as const),
    );
    return new Map(pairs);
  }, [vendors.map((v) => v.id).join(',')]);
}

export default function VendorsList() {
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

  const vendors = useLiveQuery(() =>
    activeWhere(db.vendors)
      .toArray()
      .then((rows) => rows.sort((a, b) => a.name.localeCompare(b.name))),
  );

  const filtered = (vendors ?? []).filter(
    (v) => v.name.toLowerCase().includes(q.toLowerCase()) || v.phone.includes(q),
  );
  const visibleRows = filtered.slice(0, visible);
  const balances = useVisibleBalances(visibleRows);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q]);

  return (
    <>
      <TopBar title="Vendors" />
      <PageContainer>
        <div className="mb-3">
          <SearchBar value={q} onChange={setQ} placeholder="Search vendors…" />
        </div>
        {!vendors ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Truck} title="No vendors yet" description="Add vendors to track payables." />
        ) : (
          <>
            <div className="list-shell">
              {visibleRows.map((v) => {
                const balance = balances?.get(v.id) ?? 0;
                return (
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
                      <MoneyDisplay amount={balance} className="text-sm font-semibold" tone={balance > 0 ? 'expense' : 'neutral'} />
                      <p className="text-xs text-muted">{balance > 0 ? 'you owe' : 'settled'}</p>
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

      <FAB onClick={() => setOpen(true)} label="New vendor" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Vendor">
        <VendorForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
