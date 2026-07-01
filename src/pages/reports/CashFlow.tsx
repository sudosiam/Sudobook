import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { PrintIconButton } from '@/components/common/PrintButton';
import { db } from '@/lib/db';
import { getCashFlow } from '@/lib/reports';
import { fyDateRange } from '@/lib/sequences';
import { useAppStore } from '@/store/useAppStore';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { usePeriodStore, periodRange, periodLabel } from '@/store/usePeriodStore';

export default function CashFlow() {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const cf = useLiveQuery(async () => {
    await db.journalEntries.count();
    const { start, end } = range ?? fyDateRange(currentFY);
    return getCashFlow(start, end);
  }, [range?.start, range?.end, currentFY]);

  return (
    <>
      <TopBar
        title="Cash Flow"
        right={
          <div className="flex items-center gap-1.5">
            <PeriodFilter placement="header" className="no-print" />
            <PrintIconButton />
          </div>
        }
      />
      <PageContainer>
        {!cf ? (
          <LoadingSpinner />
        ) : (
          <>
            <p className="no-print mb-2 text-xs text-muted">
              {range ? periodLabel({ mode, year, month }) : `Financial Year ${currentFY}`}
            </p>
          <div className="print-area list-shell divide-y divide-border-app">
            <Row label="Opening Cash & Bank" amount={cf.opening} />
            <Row label="Operating Activities" amount={cf.operating} colored />
            <Row label="Investing Activities" amount={cf.investing} colored />
            <Row label="Financing Activities" amount={cf.financing} colored />
            <Row label="Net Change" amount={cf.netChange} colored bold />
            <Row label="Closing Cash & Bank" amount={cf.closing} bold />
          </div>
          </>
        )}
      </PageContainer>
    </>
  );
}

function Row({
  label,
  amount,
  bold,
  colored,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  colored?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-sm text-foreground' : 'text-sm text-muted'}>{label}</span>
      <MoneyDisplay amount={amount} colored={colored} className="text-sm" />
    </div>
  );
}
