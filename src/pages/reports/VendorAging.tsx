import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Truck } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { EmptyState } from '@/components/common/EmptyState';
import { PrintIconButton } from '@/components/common/PrintButton';
import { db } from '@/lib/db';
import { AGING_BUCKETS, getVendorAging, type AgingBucket } from '@/lib/reports';

const BUCKET_LABELS: Record<AgingBucket, string> = {
  '0-30': '0–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
};

export default function VendorAging() {
  const asOf = format(new Date(), 'yyyy-MM-dd');
  const report = useLiveQuery(async () => {
    await db.purchases.count();
    return getVendorAging(asOf);
  }, [asOf]);

  return (
    <>
      <TopBar title="Vendor Aging" right={<PrintIconButton />} />
      <PageContainer>
        <p className="mb-3 text-xs text-muted">As on {asOf} · Outstanding payables by age</p>
        {!report ? (
          <LoadingSpinner />
        ) : report.rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No outstanding payables"
            description="Credit purchases with balance due will appear here."
          />
        ) : (
          <div className="print-area page-stack">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {AGING_BUCKETS.map((b) => (
                <div key={b} className="rounded-xl border border-border-app bg-surface p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted">{BUCKET_LABELS[b]}</p>
                  <MoneyDisplay
                    amount={report.totals[b]}
                    tone={b === '90+' ? 'expense' : 'neutral'}
                    className="mt-1 block text-sm font-semibold"
                  />
                </div>
              ))}
            </div>

            <div className="scroll-touch overflow-x-auto rounded-xl border border-border-app bg-surface">
              <div className="grid min-w-[560px] grid-cols-[1fr_repeat(4,minmax(0,4.5rem))_minmax(0,5rem)] gap-1 border-b border-border-app bg-app px-3 py-2 text-[10px] uppercase tracking-wider text-muted">
                <span>Vendor</span>
                {AGING_BUCKETS.map((b) => (
                  <span key={b} className="text-right">
                    {b}
                  </span>
                ))}
                <span className="text-right">Total</span>
              </div>
              {report.rows.map((row) => (
                <Link
                  key={row.partyId}
                  to={`/vendors/${row.partyId}`}
                  className="grid min-w-[560px] grid-cols-[1fr_repeat(4,minmax(0,4.5rem))_minmax(0,5rem)] gap-1 border-b border-border-app px-3 py-3 last:border-0 active:bg-surface-hover"
                >
                  <span className="truncate text-sm text-foreground">{row.partyName}</span>
                  {AGING_BUCKETS.map((b) => (
                    <MoneyDisplay
                      key={b}
                      amount={row.buckets[b]}
                      className="text-right text-[11px] tabular-nums"
                      tone={row.buckets[b] > 0 && b === '90+' ? 'expense' : 'neutral'}
                    />
                  ))}
                  <MoneyDisplay amount={row.total} tone="expense" className="text-right text-xs font-semibold" />
                </Link>
              ))}
              <div className="grid min-w-[560px] grid-cols-[1fr_repeat(4,minmax(0,4.5rem))_minmax(0,5rem)] gap-1 bg-app px-3 py-3 font-semibold">
                <span className="text-sm text-foreground">Total</span>
                {AGING_BUCKETS.map((b) => (
                  <MoneyDisplay key={b} amount={report.totals[b]} className="text-right text-[11px]" />
                ))}
                <MoneyDisplay amount={report.grandTotal} tone="expense" className="text-right text-xs" />
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}
