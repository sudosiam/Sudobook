import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Package } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { EmptyState } from '@/components/common/EmptyState';
import { PrintIconButton } from '@/components/common/PrintButton';
import { db } from '@/lib/db';
import { getInventoryValuation } from '@/lib/reports';

export default function InventoryValuation() {
  const report = useLiveQuery(async () => {
    await db.products.count();
    return getInventoryValuation();
  });

  return (
    <>
      <TopBar title="Inventory Valuation" right={<PrintIconButton />} />
      <PageContainer>
        {!report ? (
          <LoadingSpinner />
        ) : report.rows.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory"
            description="Add products to see stock valuation."
          />
        ) : (
          <div className="print-area page-stack">
            <div className="grid grid-cols-2 gap-2">
              <div className="card">
                <p className="text-xs uppercase tracking-wider text-muted">Cost Value</p>
                <MoneyDisplay amount={report.totalCostValue} className="mt-1 block text-xl font-bold" />
                <p className="mt-1 text-[10px] text-disabled">At last purchase cost</p>
              </div>
              <div className="card">
                <p className="text-xs uppercase tracking-wider text-muted">Retail Value</p>
                <MoneyDisplay amount={report.totalRetailValue} tone="income" className="mt-1 block text-xl font-bold" />
                <p className="mt-1 text-[10px] text-disabled">At selling price</p>
              </div>
            </div>

            {report.lowStockCount > 0 && (
              <p className="text-xs text-warning">
                {report.lowStockCount} product{report.lowStockCount === 1 ? '' : 's'} at or below minimum stock
              </p>
            )}

            <div className="list-shell">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border-app bg-app px-4 py-2 text-[10px] uppercase tracking-wider text-muted">
                <span>Product</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Cost Value</span>
              </div>
              {report.rows.map((row) => (
                <Link
                  key={row.productId}
                  to={`/inventory/${row.productId}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
                >
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${row.lowStock ? 'text-warning' : 'text-foreground'}`}>
                      {row.name}
                      {row.lowStock && ' · low'}
                    </p>
                    <p className="text-xs text-muted">
                      {row.sku} · {row.category}
                    </p>
                  </div>
                  <span className="self-center text-right text-sm tabular-nums text-foreground">
                    {row.stockQty}
                  </span>
                  <MoneyDisplay amount={row.costValue} className="self-center text-right text-sm font-semibold" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}
