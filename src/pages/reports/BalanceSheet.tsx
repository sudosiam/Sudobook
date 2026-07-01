import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { PrintIconButton } from '@/components/common/PrintButton';
import { db } from '@/lib/db';
import { getBalanceSheet, getDashboardMetrics } from '@/lib/reports';
import { fyDateRange, getFYStartYear } from '@/lib/sequences';
import { useAppStore } from '@/store/useAppStore';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';
import { cn } from '@/lib/utils';

export default function BalanceSheet() {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const bs = useLiveQuery(async () => {
    await db.journalEntries.count();
    if (range) {
      const fyStartYear = getFYStartYear(new Date(range.end));
      return getBalanceSheet(range.end, `${fyStartYear}-04-01`);
    }
    const { start, end } = fyDateRange(currentFY);
    return getBalanceSheet(end, start);
  }, [range?.start, range?.end, currentFY]);

  const summary = useLiveQuery(async () => {
    await db.journalEntries.count();
    if (range) {
      const fyStartYear = getFYStartYear(new Date(range.end));
      return getDashboardMetrics(`${fyStartYear}-04-01`, range.end);
    }
    const { start, end } = fyDateRange(currentFY);
    return getDashboardMetrics(start, end);
  }, [range?.start, range?.end, currentFY]);

  if (!bs || !summary) return <LoadingSpinner />;

  return (
    <>
      <TopBar
        title="Balance Sheet"
        right={
          <div className="flex items-center gap-1.5">
            <PeriodFilter placement="header" className="no-print" />
            <PrintIconButton />
          </div>
        }
      />
      <PageContainer>
        <div className="print-area flex flex-col gap-2 md:gap-3">
          <div className="grid grid-cols-2 gap-1.5 md:gap-2">
            <div className="card p-2 md:p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted md:text-xs">
                Net Worth · FY {currentFY}
              </p>
              <MoneyDisplay
                amount={summary.netWorth}
                tone="income"
                className="mt-0.5 block text-base font-semibold tabular-nums md:mt-1 md:text-xl"
              />
            </div>
            <div className="card p-2 md:p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted md:text-xs">Business Value</p>
              <MoneyDisplay
                amount={summary.businessValue}
                tone="income"
                className="mt-0.5 block text-base font-semibold tabular-nums md:mt-1 md:text-xl"
              />
              <p className="mt-0.5 text-[9px] leading-tight text-disabled md:text-[10px]">
                Cash + bank + stock + due − payable
              </p>
            </div>
          </div>

          <Section title="Assets">
            {bs.assets.map((l) => (
              <Row key={l.code} label={l.name} amount={l.amount} />
            ))}
            <Row label="Total Assets" amount={bs.totalAssets} bold />
          </Section>

          <Section title="Liabilities">
            {bs.liabilities.map((l) => (
              <Row key={l.code} label={l.name} amount={l.amount} />
            ))}
            <Row label="Total Liabilities" amount={bs.totalLiabilities} bold />
          </Section>

          <Section title="Equity">
            {bs.equity.map((l) => (
              <Row key={l.code} label={l.name} amount={l.amount} />
            ))}
            {bs.priorProfit !== 0 && (
              <Row label="Retained (Prior Years)" amount={bs.priorProfit} />
            )}
            <Row label="Current Period Profit" amount={bs.currentProfit} />
            <Row label="Total Equity" amount={bs.totalEquity} bold />
          </Section>

          <div className="flex items-center justify-between gap-2 card px-2.5 py-2 font-semibold md:px-3 md:py-2.5">
            <span className="min-w-0 truncate text-xs text-foreground md:text-sm">Liabilities + Equity</span>
            <MoneyDisplay amount={bs.totalLiabilitiesAndEquity} className="shrink-0 text-xs md:text-sm" />
          </div>

          <p
            className={cn(
              'py-0.5 text-center text-[11px] md:text-sm',
              bs.balanced ? 'text-success' : 'text-danger',
            )}
          >
            {bs.balanced ? '✓ Assets = Liabilities + Equity' : '✗ Out of balance'}
          </p>
        </div>
      </PageContainer>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="list-shell">
      <div className="border-b border-border-app/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted md:px-3 md:py-1.5 md:text-xs">
        {title}
      </div>
      <div className="divide-y divide-border-app/35">{children}</div>
    </div>
  );
}

function Row({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-2.5 py-1.5 md:px-3 md:py-2',
        bold && 'bg-surface-hover/20 font-semibold',
      )}
    >
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-xs md:text-sm',
          bold ? 'text-foreground' : 'text-muted',
        )}
      >
        {label}
      </span>
      <MoneyDisplay amount={amount} className="shrink-0 text-xs tabular-nums md:text-sm" />
    </div>
  );
}
