import { lazy, Suspense, useCallback } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard } from '@/components/common/StatCard';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { FABMenu, dashboardAddItems } from '@/components/common/FABMenu';
import { Skeleton, SkeletonChartCard, SkeletonStatGrid } from '@/components/common/Skeleton';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { Reveal, RevealItem } from '@/components/common/Reveal';
import { useFinancials } from '@/hooks/useFinancials';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useSync } from '@/hooks/useSync';
import { useAppStore } from '@/store/useAppStore';
import { usePeriodStore } from '@/store/usePeriodStore';
import { formatSyncAgo } from '@/lib/display';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

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
  const { syncNow } = useSync();
  const lastSyncAt = useLiveQuery(() => db.settings.get('singleton').then((s) => s?.lastSyncAt ?? null), []);
  const syncedAgo = formatSyncAgo(lastSyncAt ?? undefined);

  const onRefresh = useCallback(async () => {
    await syncNow();
  }, [syncNow]);
  const { pulling, pullPx } = usePullToRefresh(onRefresh);

  const chartsLoading = series === undefined || netWorthSeries === undefined;

  return (
    <>
      <TopBar title="Sudo" right={<PeriodFilter placement="header" />} />
      {pullPx > 0 && (
        <div
          className="pointer-events-none flex justify-center text-xs text-muted"
          style={{ height: pullPx }}
        >
          {pulling ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}
      <PageContainer>
        {chartsLoading ? (
          <div className="page-stack pb-1">
            <Skeleton className="h-20 rounded-2xl" />
            <SkeletonStatGrid count={8} />
            <SkeletonChartCard />
            <SkeletonChartCard />
          </div>
        ) : (
          <Reveal className="page-stack pb-1">
            {syncedAgo && (
              <RevealItem>
                <p className="text-[11px] text-muted">Updated {syncedAgo}</p>
              </RevealItem>
            )}
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
              <StatCard label="Revenue" amount={metrics.revenue} animate to="/reports/pnl" />
              <StatCard label="COGS" amount={metrics.cogs} animate to="/reports/pnl" />
              <StatCard label="Gross Profit" amount={metrics.grossProfit} tone="profit" animate to="/reports/pnl" />
              <StatCard label="Operating Exp." amount={metrics.operatingExpenses} animate to="/reports/pnl" />
              <StatCard label="Receivables" amount={metrics.receivable} tone="partial" animate to="/payments" />
              <StatCard label="Payable" amount={metrics.payable} animate to="/payments/payable" />
              <StatCard label="Inventory" amount={metrics.inventory} animate to="/inventory" />
              <StatCard label="Total Liquid" amount={metrics.totalLiquid} hint="Cash + bank" animate to="/banking" />
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
