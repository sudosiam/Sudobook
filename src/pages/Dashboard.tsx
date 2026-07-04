import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard } from '@/components/common/StatCard';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { FABMenu, dashboardAddItems } from '@/components/common/FABMenu';
import { Skeleton, SkeletonChartCard, SkeletonStatGrid } from '@/components/common/Skeleton';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { Reveal, RevealItem } from '@/components/common/Reveal';
import { useFinancials } from '@/hooks/useFinancials';
import { useAppStore } from '@/store/useAppStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { getLowStockCount } from '@/lib/reports';
import { useLiveQuery } from '@/hooks/useLiveQuery';

const NetWorthChart = lazy(async () => {
  const mod = await import('@/components/charts/NetWorthChart');
  return { default: mod.NetWorthChart };
});

const ProfitTrendChart = lazy(async () => {
  const mod = await import('@/components/charts/ProfitTrendChart');
  return { default: mod.ProfitTrendChart };
});

export default function Dashboard() {
  const { metrics, series, netWorthSeries, isInitialLoad } = useFinancials();
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode } = usePeriodStore();
  const lowStockCount = useLiveQuery(() => getLowStockCount(), [], 0);

  const showSkeleton = isInitialLoad && series.length === 0 && netWorthSeries.length === 0;

  return (
    <>
      <TopBar title="Sudo" right={<PeriodFilter placement="header" />} />
      <PageContainer>
        {showSkeleton ? (
          <div className="page-stack pb-1">
            <Skeleton className="h-24 rounded-2xl" />
            <SkeletonStatGrid count={8} />
            <SkeletonChartCard />
            <SkeletonChartCard />
          </div>
        ) : (
          <Reveal className="page-stack pb-1">
            {mode === 'all' && (
              <RevealItem>
                <p className="text-xs text-muted">{currentFY}</p>
              </RevealItem>
            )}

            {(lowStockCount ?? 0) > 0 && (
              <RevealItem>
                <Link
                  to="/inventory"
                  className="flex min-h-[48px] items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 active:bg-warning/15"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning" aria-hidden />
                  <p className="text-sm font-medium text-foreground">
                    {lowStockCount} product{lowStockCount === 1 ? '' : 's'} low on stock
                  </p>
                </Link>
              </RevealItem>
            )}

            <RevealItem className="card-accent card-glow px-4 py-4">
              <p className="section-label">Net Profit</p>
              <MoneyDisplay
                amount={metrics.netProfit}
                tone="profit"
                className="hero-money mt-1 block !text-2xl sm:!text-[1.75rem]"
                animate
              />
              <p className="mt-2 text-[10px] leading-tight text-muted">
                Other income{' '}
                <MoneyDisplay amount={metrics.otherIncome} className="text-[10px] text-muted" />
              </p>
            </RevealItem>

            <RevealItem className="grid grid-cols-2 gap-2">
              <StatCard label="Revenue" amount={metrics.revenue} animate to="/reports/pnl" />
              <StatCard label="COGS" amount={metrics.cogs} animate to="/reports/pnl" />
              <StatCard label="Gross Profit" amount={metrics.grossProfit} tone="profit" animate to="/reports/pnl" />
              <StatCard label="Operating Exp." amount={metrics.operatingExpenses} animate to="/reports/pnl" />
              <StatCard label="Receivables" amount={metrics.receivable} tone="partial" animate to="/payments" />
              <StatCard label="Payable" amount={metrics.payable} animate to="/payments/payable" />
              <StatCard label="Inventory" amount={metrics.inventory} animate to="/inventory" />
              <StatCard label="Total Liquid" amount={metrics.totalLiquid} animate to="/banking" />
            </RevealItem>

            <RevealItem className="card">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Net Worth Trend</h2>
              <Suspense fallback={<Skeleton className="h-[176px] rounded-lg" />}>
                <NetWorthChart data={netWorthSeries} />
              </Suspense>
            </RevealItem>

            <RevealItem className="card">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Profit vs Expenses</h2>
              <Suspense fallback={<Skeleton className="h-[200px] rounded-lg" />}>
                <ProfitTrendChart data={series} />
              </Suspense>
            </RevealItem>
          </Reveal>
        )}
      </PageContainer>
      <FABMenu items={dashboardAddItems} />
    </>
  );
}
