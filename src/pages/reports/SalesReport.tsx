import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { Button } from '@/components/common/Field';
import { PrintIconButton } from '@/components/common/PrintButton';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { usePeriodStore, periodRange, periodLabel } from '@/store/usePeriodStore';
import { useAppStore } from '@/store/useAppStore';
import { fyDateRange } from '@/lib/sequences';
import { db } from '@/lib/db';
import { getSalesReport } from '@/lib/reports';
import { downloadCsv } from '@/lib/export';
import { paiseToRupees } from '@/lib/money';
import { toast } from '@/store/useToast';

export default function SalesReport() {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const report = useLiveQuery(async () => {
    await db.sales.count();
    const { start, end } = range ?? fyDateRange(currentFY);
    return getSalesReport(start, end);
  }, [range?.start, range?.end, currentFY]);

  const periodLabelText = range ? periodLabel({ mode, year, month }) : `FY ${currentFY}`;

  const handleExport = () => {
    if (!report) return;
    const amt = (p: number) => String(paiseToRupees(p));
    const rows: string[][] = [
      ['Summary', 'Sales count', String(report.count), ''],
      ['Summary', 'Total', amt(report.total), ''],
      ['Summary', 'Collected', amt(report.paid), ''],
      ['Summary', 'Outstanding', amt(report.due), ''],
      ...report.byPaymentMethod.map((m) => ['Payment', m.method, String(m.count), amt(m.total)]),
      ...report.byProduct.map((p) => ['Product', p.productName, String(p.qty), amt(p.total)]),
      ...report.byCustomer.map((c) => ['Customer', c.partyName, String(c.count), amt(c.total)]),
    ];
    downloadCsv(`sales-report-${periodLabelText.replace(/\s+/g, '-')}.csv`, ['Section', 'Name', 'Count/Qty', 'Amount (INR)'], rows);
    toast.success('CSV downloaded');
  };

  return (
    <>
      <TopBar
        title="Sales Report"
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
              <SummaryCard label="Sales" value={`${report.count}`} />
              <SummaryCard label="Total" amount={report.total} tone="income" />
              <SummaryCard label="Collected" amount={report.paid} tone="income" />
              <SummaryCard label="Outstanding" amount={report.due} tone="expense" />
            </div>

            <BreakdownSection title="By Payment Method">
              {report.byPaymentMethod.length === 0 ? (
                <EmptyRow />
              ) : (
                report.byPaymentMethod.map((m) => (
                  <Row key={m.method} label={`${m.method} (${m.count})`} amount={m.total} tone="income" />
                ))
              )}
            </BreakdownSection>

            <BreakdownSection title="By Product">
              {report.byProduct.length === 0 ? (
                <EmptyRow />
              ) : (
                report.byProduct.map((p) => (
                  <Row key={p.productId} label={`${p.productName} · ${p.qty} units`} amount={p.total} tone="income" />
                ))
              )}
            </BreakdownSection>

            <BreakdownSection title="By Customer">
              {report.byCustomer.length === 0 ? (
                <EmptyRow />
              ) : (
                report.byCustomer.map((c) => (
                  <Row key={c.partyId} label={`${c.partyName} (${c.count})`} amount={c.total} tone="income" />
                ))
              )}
            </BreakdownSection>
          </div>
        )}
      </PageContainer>
    </>
  );
}

function SummaryCard({
  label,
  value,
  amount,
  tone,
}: {
  label: string;
  value?: string;
  amount?: number;
  tone?: 'income' | 'expense';
}) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      {value !== undefined ? (
        <p className="mt-1 font-numeric hero-money text-foreground tabular-nums">{value}</p>
      ) : (
        <MoneyDisplay amount={amount ?? 0} tone={tone} className="mt-1 block hero-money" />
      )}
    </div>
  );
}

function BreakdownSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      <div className="list-shell">{children}</div>
    </div>
  );
}

function Row({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone?: 'income' | 'expense';
}) {
  return (
    <div className="flex items-center justify-between border-b border-border-app px-3 py-2 last:border-0">
      <span className="min-w-0 truncate text-sm text-foreground">{label}</span>
      <MoneyDisplay amount={amount} tone={tone} className="ml-3 text-sm font-semibold" />
    </div>
  );
}

function EmptyRow() {
  return <p className="px-4 py-6 text-center text-sm text-muted">No data for this period.</p>;
}
