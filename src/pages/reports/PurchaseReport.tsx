import type { ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { PrintIconButton } from '@/components/common/PrintButton';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';
import { useAppStore } from '@/store/useAppStore';
import { fyDateRange } from '@/lib/sequences';
import { db } from '@/lib/db';
import { getPurchaseReport } from '@/lib/reports';

export default function PurchaseReport() {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const report = useLiveQuery(async () => {
    await db.purchases.count();
    const { start, end } = range ?? fyDateRange(currentFY);
    return getPurchaseReport(start, end);
  }, [range?.start, range?.end, currentFY]);

  return (
    <>
      <TopBar
        title="Purchase Report"
        right={
          <div className="flex items-center gap-1.5">
            <PeriodFilter placement="header" className="no-print" />
            <PrintIconButton />
          </div>
        }
      />
      <PageContainer>
        {!report ? (
          <LoadingSpinner />
        ) : (
          <div className="print-area page-stack">
            <div className="grid grid-cols-2 gap-2">
              <SummaryCard label="Purchases" value={`${report.count}`} />
              <SummaryCard label="Total" amount={report.total} tone="expense" />
              <SummaryCard label="Paid" amount={report.paid} />
              <SummaryCard label="Due" amount={report.due} tone="expense" />
            </div>

            <BreakdownSection title="By Payment Method">
              {report.byPaymentMethod.length === 0 ? (
                <EmptyRow />
              ) : (
                report.byPaymentMethod.map((m) => (
                  <Row key={m.method} label={`${m.method} (${m.count})`} amount={m.total} tone="expense" />
                ))
              )}
            </BreakdownSection>

            <BreakdownSection title="By Product">
              {report.byProduct.length === 0 ? (
                <EmptyRow />
              ) : (
                report.byProduct.map((p) => (
                  <Row key={p.productId} label={`${p.productName} · ${p.qty} units`} amount={p.total} tone="expense" />
                ))
              )}
            </BreakdownSection>

            <BreakdownSection title="By Vendor">
              {report.byVendor.length === 0 ? (
                <EmptyRow />
              ) : (
                report.byVendor.map((v) => (
                  <Row key={v.partyId} label={`${v.partyName} (${v.count})`} amount={v.total} tone="expense" />
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
