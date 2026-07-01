import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard } from '@/components/common/StatCard';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { FABMenu, dashboardAddItems } from '@/components/common/FABMenu';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { NetWorthChart } from '@/components/charts/NetWorthChart';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { useFinancials } from '@/hooks/useFinancials';
import { useAppStore } from '@/store/useAppStore';
import { usePeriodStore } from '@/store/usePeriodStore';

export default function Dashboard() {
  const { metrics, series, netWorthSeries } = useFinancials();
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode } = usePeriodStore();

  const loading = !metrics || series === undefined || netWorthSeries === undefined;

  return (
    <>
      <TopBar
        title="Sudo Books"
        right={<PeriodFilter placement="header" />}
      />
      <PageContainer>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="page-stack pb-1">
            {mode === 'all' && (
              <p className="text-xs text-muted">Financial Year {currentFY}</p>
            )}

            <div className="card-accent">
              <p className="section-label">Net Profit</p>
              <MoneyDisplay amount={metrics.netProfit} tone="profit" className="hero-money mt-0.5 block" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Revenue" amount={metrics.revenue} />
              <StatCard label="COGS" amount={metrics.cogs} />
              <StatCard label="Gross Profit" amount={metrics.grossProfit} tone="profit" />
              <StatCard label="Operating Exp." amount={metrics.operatingExpenses} />
              <StatCard label="Receivables" amount={metrics.receivable} tone="partial" />
              <StatCard label="Total Liquid" amount={metrics.totalLiquid} hint="Cash + bank" />
            </div>

            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Last 6 Months</h2>
              <RevenueChart data={series} />
            </div>

            <div className="card">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Net Worth Trend</h2>
              <NetWorthChart data={netWorthSeries} />
            </div>
          </div>
        )}
      </PageContainer>
      <FABMenu items={dashboardAddItems} />
    </>
  );
}
