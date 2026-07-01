import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Package, Tags } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { FAB } from '@/components/common/FAB';
import { ProductForm } from '@/components/forms/ProductForm';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';

const PAGE_SIZE = 60;

export default function ProductsList() {
  const location = useLocation();
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    const state = location.state as { openNew?: boolean } | null;
    if (state?.openNew) {
      setOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  const products = useLiveQuery(() => db.products.where('isActive').equals(1).toArray());
  const categories = useLiveQuery(() => db.productCategories.where('isActive').equals(1).toArray(), []);
  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const filtered = (products ?? []).filter(
    (p) =>
      (p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())) &&
      (!categoryFilter || p.category === categoryFilter),
  );
  const visibleRows = filtered.slice(0, visible);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q, categoryFilter]);

  return (
    <>
      <TopBar
        title="Inventory"
        right={
          <Link to="/inventory/categories" className="icon-btn" aria-label="Manage categories">
            <Tags className="h-5 w-5" />
          </Link>
        }
      />
      <PageContainer>
        <div className="mb-3 space-y-2">
          <SearchBar value={q} onChange={setQ} placeholder="Search products…" />
          {categories && categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCategoryFilter(null)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  !categoryFilter
                    ? 'border-brand bg-brand/15 text-brand-light'
                    : 'border-border-app/60 text-muted active:bg-surface-hover',
                )}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryFilter(c.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    categoryFilter === c.id
                      ? 'border-brand bg-brand/15 text-brand-light'
                      : 'border-border-app/60 text-muted active:bg-surface-hover',
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {!products ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title="No products yet" description="Add your EV products to track stock." />
        ) : (
          <>
            <div className="space-y-2">
              {visibleRows.map((p) => {
                const low = p.stockQty <= p.minStock;
                return (
                  <Link
                    key={p.id}
                    to={`/inventory/${p.id}`}
                    className="flex min-h-[52px] items-center justify-between rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {p.sku} · {categoryNames.get(p.category) ?? p.category}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
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

      <FAB onClick={() => setOpen(true)} label="New product" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Product">
        <ProductForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
