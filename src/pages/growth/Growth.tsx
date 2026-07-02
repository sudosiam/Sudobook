import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { PrintIconButton } from '@/components/common/PrintButton';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { ProfitTrendChart } from '@/components/charts/ProfitTrendChart';
import { ExpenseChart } from '@/components/charts/ExpenseChart';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { format, startOfMonth, subMonths } from 'date-fns';
import { db } from '@/lib/db';
import { getExpenseReport, getMonthlySeries, getNetWorthSeries, getSalesMix, getTopCustomers, getAverageSaleValue } from '@/lib/reports';
import { addMoney } from '@/lib/money';

export default function Growth() {
  const series = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getMonthlySeries(12);
  });

  const netWorthSeries = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getNetWorthSeries(12);
  });

  const topProducts = useLiveQuery(async () => {
    const sales = await db.sales.filter((s) => s.status !== 'void').toArray();
    const map = new Map<string, { productId: string; name: string; revenue: number }>();
    for (const s of sales) {
      for (const it of s.items) {
        const cur = map.get(it.productId) ?? { productId: it.productId, name: it.productName, revenue: 0 };
        cur.revenue += it.total;
        map.set(it.productId, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  });

  const topCustomers = useLiveQuery(async () => {
    await db.sales.count();
    return getTopCustomers(5);
  });

  const salesMix = useLiveQuery(async () => {
    await db.sales.count();
    return getSalesMix();
  });

  const avgSale = useLiveQuery(async () => {
    await db.sales.count();
    return getAverageSaleValue();
  });

  const expenseBreakdown = useLiveQuery(async () => {
    await db.expenses.count();
    const end = format(new Date(), 'yyyy-MM-dd');
    const start = format(startOfMonth(subMonths(new Date(), 11)), 'yyyy-MM-dd');
    const report = await getExpenseReport(start, end);
    return report.byCategory.map((c) => ({ name: c.category, value: c.total }));
  });

  if (!series || !netWorthSeries || !salesMix || avgSale === undefined) return <LoadingSpinner />;

  const totalRevenue = addMoney(...series.map((s) => s.revenue));

  return (
    <>
      <TopBar title="Growth" right={<PrintIconButton />} />
      <PageContainer>
        <div className="print-area page-stack">
          <div className="card">
            <p className="text-xs uppercase tracking-wider text-muted">Revenue · Last 12 Months</p>
            <MoneyDisplay amount={totalRevenue} tone="income" className="mb-1 block text-xl font-bold" />
            <div className="mt-3">
              <RevenueChart data={series} />
            </div>
          </div>

          <div className="card">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Net Worth Trend</h2>
            <div className="mt-3">
              <NetWorthChart data={netWorthSeries} />
            </div>
          </div>

          <div className="card">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Profit vs Expenses</h2>
            <div className="mt-3">
              <ProfitTrendChart data={series} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="card">
              <p className="text-xs uppercase tracking-wider text-muted">Avg Sale Value</p>
              <MoneyDisplay amount={avgSale} tone="income" className="mt-1 block text-lg font-bold" />
            </div>
            <div className="card">
              <p className="text-xs uppercase tracking-wider text-muted">Cash Sales</p>
              <MoneyDisplay amount={salesMix.cashTotal} tone="income" className="mt-1 block text-lg font-bold" />
            </div>
            <div className="card sm:col-span-1 col-span-1">
              <p className="text-xs uppercase tracking-wider text-muted">Credit Sales</p>
              <MoneyDisplay amount={salesMix.creditTotal} className="mt-1 block text-lg font-bold" />
            </div>
          </div>

          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Top Products</h2>
            {(topProducts ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">No sales yet.</p>
            ) : (
              <div className="divide-y divide-border-app">
                {(topProducts ?? []).map((p, i) => (
                  <div key={p.productId} className="flex items-center justify-between py-2.5">
                    <span className="text-sm text-foreground">
                      {i + 1}. {p.name}
                    </span>
                    <MoneyDisplay amount={p.revenue} tone="income" className="text-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Top Customers</h2>
            {(topCustomers ?? []).length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">No sales yet.</p>
            ) : (
              <div className="divide-y divide-border-app">
                {(topCustomers ?? []).map((c, i) => (
                  <div key={c.customerId} className="flex items-center justify-between py-2.5">
                    <span className="min-w-0 truncate text-sm text-foreground">
                      {i + 1}. {c.customerName}
                      <span className="ml-1 text-xs text-muted">({c.count})</span>
                    </span>
                    <MoneyDisplay amount={c.total} tone="income" className="text-sm" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {(expenseBreakdown ?? []).length > 0 && (
            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Expense Breakdown</h2>
              <ExpenseChart data={expenseBreakdown ?? []} />
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}
