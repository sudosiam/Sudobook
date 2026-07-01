import { lazy, Suspense } from 'react';
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

const NetWorthChart = lazy(async () => {
  const mod = await import('@/components/charts/NetWorthChart');
  return { default: mod.NetWorthChart };
});

const ProfitTrendChart = lazy(async () => {
  const mod = await import('@/components/charts/ProfitTrendChart');
  return { default: mod.ProfitTrendChart };
});

export default function Dashboard() {
  const { metrics, series, netWorthSeries } = useFinancials();
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode } = usePeriodStore();

  const loading = !metrics || series === undefined || netWorthSeries === undefined;

  return (
    <>
      <TopBar
        title="Sudo"
        right={<PeriodFilter placement="header" />}
      />
      <PageContainer>
        {loading ? (
          <div className="page-stack pb-1">
            <Skeleton className="h-20 rounded-2xl" />
            <SkeletonStatGrid count={8} />
            <SkeletonChartCard />
            <SkeletonChartCard />
          </div>
        ) : (
          <Reveal className="page-stack pb-1">
            {mode === 'all' && (
              <RevealItem>
                <p className="text-xs text-muted">Financial Year {currentFY}</p>
              </RevealItem>
            )}

            <RevealItem className="card-accent card-glow">
              <p className="section-label">Net Profit</p>
              <MoneyDisplay amount={metrics.netProfit} tone="profit" className="hero-money mt-0.5 block" animate />
            </RevealItem>

            <RevealItem className="grid grid-cols-2 gap-2">
              <StatCard label="Revenue" amount={metrics.revenue} animate />
              <StatCard label="COGS" amount={metrics.cogs} animate />
              <StatCard label="Gross Profit" amount={metrics.grossProfit} tone="profit" animate />
              <StatCard label="Operating Exp." amount={metrics.operatingExpenses} animate />
              <StatCard label="Receivables" amount={metrics.receivable} tone="partial" animate />
              <StatCard label="Payable" amount={metrics.payable} animate />
              <StatCard label="Inventory" amount={metrics.inventory} animate />
              <StatCard label="Total Liquid" amount={metrics.totalLiquid} hint="Cash + bank" animate />
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
