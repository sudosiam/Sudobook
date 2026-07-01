import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { PrintIconButton } from '@/components/common/PrintButton';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { db } from '@/lib/db';
import { getTrialBalance } from '@/lib/reports';
import { usePeriodStore, periodRange, periodLabel } from '@/store/usePeriodStore';

export default function TrialBalance() {
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const tb = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getTrialBalance(range?.end);
  }, [range?.end]);

  if (!tb) return <LoadingSpinner />;

  return (
    <>
      <TopBar
        title="Trial Balance"
        right={
          <div className="flex items-center gap-1.5">
            <PeriodFilter placement="header" className="no-print" />
            <PrintIconButton />
          </div>
        }
      />
      <PageContainer>
        <p className="no-print mb-2 text-xs text-muted">
          {range ? `As on ${periodLabel({ mode, year, month })}` : 'All time'}
        </p>
        <div className="print-area list-shell">
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border-app px-4 py-2 text-xs uppercase tracking-wider text-muted">
            <span>Account</span>
            <span className="w-24 text-right">Debit</span>
            <span className="w-24 text-right">Credit</span>
          </div>
          {tb.rows.map((r) => (
            <div key={r.code} className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border-app px-3 py-2 last:border-0">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{r.name}</p>
                <p className="font-numeric text-xs text-muted">{r.code}</p>
              </div>
              <span className="w-24 text-right">
                {r.debit > 0 ? <MoneyDisplay amount={r.debit} className="text-xs" /> : <span className="text-disabled">—</span>}
              </span>
              <span className="w-24 text-right">
                {r.credit > 0 ? <MoneyDisplay amount={r.credit} className="text-xs" /> : <span className="text-disabled">—</span>}
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-app px-4 py-3 font-semibold">
            <span className="text-sm text-foreground">Total</span>
            <MoneyDisplay amount={tb.totalDebit} className="w-24 text-right text-xs" />
            <MoneyDisplay amount={tb.totalCredit} className="w-24 text-right text-xs" />
          </div>
        </div>
        <p className={`mt-3 text-center text-sm ${tb.balanced ? 'text-success' : 'text-danger'}`}>
          {tb.balanced ? '✓ Balanced' : '✗ Not balanced — check entries'}
        </p>
      </PageContainer>
    </>
  );
}
