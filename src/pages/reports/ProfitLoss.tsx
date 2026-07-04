import { useLiveQuery } from '@/hooks/useLiveQuery';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay, type MoneyTone } from '@/components/common/MoneyDisplay';
import { PrintIconButton } from '@/components/common/PrintButton';
import { db } from '@/lib/db';
import { getProfitLoss } from '@/lib/reports';
import { fyDateRange } from '@/lib/sequences';
import { useAppStore } from '@/store/useAppStore';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';

export default function ProfitLoss() {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const pl = useLiveQuery(async () => {
    await db.journalEntries.count();
    const { start, end } = range ?? fyDateRange(currentFY);
    return getProfitLoss(start, end);
  }, [range?.start, range?.end, currentFY]);

  return (
    <>
      <TopBar
        title="Profit & Loss"
        right={
          <div className="flex items-center gap-1.5">
            <PeriodFilter placement="header" className="no-print" />
            <PrintIconButton />
          </div>
        }
      />
      <PageContainer>
        {!pl ? (
          <LoadingSpinner />
        ) : (
        <div className="print-area page-stack">
          <Section title="Income">
            {pl.income.map((l) => (
              <Row key={l.code} label={l.name} amount={l.amount} />
            ))}
            <Row label="Total Revenue" amount={pl.totalRevenue} bold />
          </Section>

          <Section title="Cost of Goods Sold">
            <Row label="COGS" amount={pl.cogs} />
            <Row label={`Gross Profit (${pl.grossMarginPct}%)`} amount={pl.grossProfit} bold tone="profit" />
          </Section>

          <Section title="Operating Expenses">
            {pl.expenses.map((l) => (
              <Row key={l.code} label={l.name} amount={l.amount} />
            ))}
            <Row label="Total Expenses" amount={pl.totalExpenses} bold />
          </Section>

          <div className="flex items-center justify-between card-accent">
            <span className="text-base font-bold text-foreground">Net Profit ({pl.netMarginPct}%)</span>
            <MoneyDisplay amount={pl.netProfit} tone="profit" className="text-lg font-bold" />
          </div>
        </div>
        )}
      </PageContainer>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="list-shell">
      <div className="border-b border-border-app px-4 py-2 text-xs uppercase tracking-wider text-muted">
        {title}
      </div>
      <div className="divide-y divide-border-app">{children}</div>
    </div>
  );
}

function Row({
  label,
  amount,
  bold,
  tone = 'neutral',
}: {
  label: string;
  amount: number;
  bold?: boolean;
  tone?: MoneyTone | 'income' | 'expense' | 'neutral';
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-sm text-foreground' : 'text-sm text-muted'}>{label}</span>
      <MoneyDisplay amount={amount} tone={tone} className="text-sm" />
    </div>
  );
}
