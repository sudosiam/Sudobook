import { useLiveQuery } from '@/hooks/useLiveQuery';
import { Download } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { Button } from '@/components/common/Field';
import { PrintIconButton } from '@/components/common/PrintButton';
import { ExpenseChart } from '@/components/charts/ExpenseChart';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { usePeriodStore, periodRange, periodLabel } from '@/store/usePeriodStore';
import { useAppStore } from '@/store/useAppStore';
import { fyDateRange } from '@/lib/sequences';
import { db } from '@/lib/db';
import { getExpenseReport } from '@/lib/reports';
import { downloadCsv } from '@/lib/export';
import { paiseToRupees } from '@/lib/money';
import { toast } from '@/store/useToast';

export default function ExpenseReport() {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const report = useLiveQuery(async () => {
    await db.expenses.count();
    const { start, end } = range ?? fyDateRange(currentFY);
    return getExpenseReport(start, end);
  }, [range?.start, range?.end, currentFY]);

  const chartData = (report?.byCategory ?? []).map((c) => ({ name: c.category, value: c.total }));
  const periodLabelText = range ? periodLabel({ mode, year, month }) : `FY ${currentFY}`;

  const handleExport = () => {
    if (!report) return;
    const amt = (p: number) => String(paiseToRupees(p));
    downloadCsv(
      `expense-report-${periodLabelText.replace(/\s+/g, '-')}.csv`,
      ['Category', 'Account', 'Count', 'Amount (INR)'],
      report.byCategory.map((c) => [c.category, String(c.accountCode), String(c.count), amt(c.total)]),
    );
    toast.success('CSV downloaded');
  };

  return (
    <>
      <TopBar
        title="Expense Report"
        right={
          <div className="flex items-center gap-1.5">
            <PeriodFilter placement="header" className="no-print" />
            <PrintIconButton />
          </div>
        }
      />
      <PageContainer>
        {report && report.count > 0 && (
          <Button variant="secondary" className="no-print mb-3 w-full" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        )}
        {!report ? (
          <LoadingSpinner />
        ) : (
          <div className="print-area page-stack">
            <div className="grid grid-cols-2 gap-2">
              <div className="card">
                <p className="text-xs uppercase tracking-wider text-muted">Expenses</p>
                <p className="mt-1 font-numeric hero-money text-foreground tabular-nums">{report.count}</p>
              </div>
              <div className="card">
                <p className="text-xs uppercase tracking-wider text-muted">Total</p>
                <MoneyDisplay amount={report.total} tone="expense" className="mt-1 block hero-money" />
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="card">
                <h2 className="mb-3 text-sm font-semibold text-foreground">By Category</h2>
                <ExpenseChart data={chartData} />
              </div>
            )}

            <div className="list-shell">
              {report.byCategory.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">No expenses for this period.</p>
              ) : (
                report.byCategory.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between border-b border-border-app px-3 py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm text-foreground">{c.category}</p>
                      <p className="text-xs text-muted">
                        {c.count} entries · acct {c.accountCode}
                      </p>
                    </div>
                    <MoneyDisplay amount={c.total} tone="expense" className="text-sm font-semibold" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}
