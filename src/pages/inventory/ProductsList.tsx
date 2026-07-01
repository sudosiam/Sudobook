import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Package } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { FAB } from '@/components/common/FAB';
import { ProductForm } from '@/components/forms/ProductForm';
import { db } from '@/lib/db';

export default function ProductsList() {
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
  const products = useLiveQuery(() => db.products.filter((p) => p.isActive).toArray());

  const filtered = (products ?? []).filter(
    (p) => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <TopBar title="Inventory" />
      <PageContainer>
        <div className="mb-3">
          <SearchBar value={q} onChange={setQ} placeholder="Search products…" />
        </div>
        {!products ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No products yet" description="Add your EV products to track stock." />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => {
              const low = p.stockQty <= p.minStock;
              return (
                <Link
                  key={p.id}
                  to={`/inventory/${p.id}`}
                  className="flex min-h-[52px] items-center justify-between rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{p.sku}</p>
                  </div>
                  <div className="ml-3 text-right">
                    <p className={`text-sm font-semibold ${low ? 'text-warning' : 'text-foreground'}`}>
                      {p.stockQty} {p.unit}
                      {low && ' · low'}
                    </p>
                    <MoneyDisplay amount={p.sellingPrice} className="text-xs text-muted" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </PageContainer>

      <FAB onClick={() => setOpen(true)} label="New product" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Product">
        <ProductForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
