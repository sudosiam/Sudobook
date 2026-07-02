import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Package, Tags } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { FAB } from '@/components/common/FAB';
import { VirtualList } from '@/components/common/VirtualList';
import { ProductForm } from '@/components/forms/ProductForm';
import { useStaleLiveQuery } from '@/hooks/useStaleLiveQuery';
import { cn } from '@/lib/utils';
import { db, activeWhere, type Product } from '@/lib/db';
import { LIST_PAGE_SIZE, queryProductsPage } from '@/lib/listQueries';

export default function ProductsList() {
  const location = useLocation();
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(LIST_PAGE_SIZE);

  useEffect(() => {
    const state = location.state as { openNew?: boolean } | null;
    if (state?.openNew) {
      setOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    setLimit(LIST_PAGE_SIZE);
  }, [q, categoryFilter]);

  const categories = useStaleLiveQuery(() => activeWhere(db.productCategories).toArray(), []);
  const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const queryKey = `${categoryFilter ?? 'all'}:${q}:${limit}`;
  const products = useStaleLiveQuery(
    () => queryProductsPage(limit + 1, categoryFilter, q),
    [queryKey],
  );

  const rows = useMemo(() => (products ?? []).slice(0, limit), [products, limit]);
  const hasMore = (products?.length ?? 0) > limit;
  const isInitialLoad = products === undefined;

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
        {isInitialLoad ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyState icon={Package} title="No products yet" />
        ) : (
          <VirtualList
            shell={false}
            items={rows}
            estimateSize={96}
            getKey={(p) => p.id}
            hasMore={hasMore}
            onLoadMore={() => setLimit((n) => n + LIST_PAGE_SIZE)}
            renderItem={(p: Product) => {
              const low = p.stockQty <= p.minStock;
              return (
                <Link
                  to={`/inventory/${p.id}`}
                  className="mb-2 flex min-h-[88px] items-center justify-between rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      {p.sku} · {categoryNames.get(p.category) ?? p.category}
                    </p>
                    {p.minStock > 0 && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border-app/60">
                        <div
                          className={`h-full rounded-full ${low ? 'bg-warning' : 'bg-success'}`}
                          style={{
                            width: `${Math.min(100, Math.round((p.stockQty / Math.max(p.minStock * 2, 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
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
            }}
          />
        )}
      </PageContainer>

      <FAB onClick={() => setOpen(true)} label="New product" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Product">
        <ProductForm onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
