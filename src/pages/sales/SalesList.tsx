import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banknote, CreditCard, ShoppingBag, Smartphone, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { FAB } from '@/components/common/FAB';
import { MoneyDisplay, moneyToneForStatus } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { StatusPill } from '@/components/common/StatusPill';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { Select, Button } from '@/components/common/Field';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';
import { db, type DocStatus, type PaymentMethod } from '@/lib/db';
import { saleInvoiceTotal } from '@/lib/sales';
import { formatDisplayDate } from '@/lib/display';

const STATUS_OPTIONS: { value: '' | DocStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'partial', label: 'Partial' },
  { value: 'credit', label: 'Credit' },
  { value: 'void', label: 'Void' },
];

const PAYMENT_OPTIONS: { value: '' | PaymentMethod; label: string }[] = [
  { value: '', label: 'All payments' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank' },
  { value: 'upi', label: 'UPI' },
  { value: 'partial', label: 'Partial' },
  { value: 'credit', label: 'Credit' },
];

const PAYMENT_ICON: Record<PaymentMethod, LucideIcon> = {
  cash: Wallet,
  bank: Banknote,
  upi: Smartphone,
  partial: CreditCard,
  credit: CreditCard,
};

const PAGE_SIZE = 50;

export default function SalesList() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q);
  const [statusFilter, setStatusFilter] = useState<'' | DocStatus>('');
  const [paymentFilter, setPaymentFilter] = useState<'' | PaymentMethod>('');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const sales = useLiveQuery(
    () =>
      range
        ? db.sales.where('date').between(range.start, range.end, true, true).reverse().toArray()
        : db.sales.orderBy('date').reverse().toArray(),
    [range?.start, range?.end],
  );

  const filtered = (sales ?? []).filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (paymentFilter && s.paymentMethod !== paymentFilter) return false;
    const query = debouncedQ.toLowerCase();
    if (!query) return true;
    return (
      s.customerName.toLowerCase().includes(query) || s.saleNumber.toLowerCase().includes(query)
    );
  });

  const visibleRows = filtered.slice(0, visible);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [debouncedQ, statusFilter, paymentFilter, range?.start, range?.end]);

  return (
    <>
      <TopBar title="Sales" right={<PeriodFilter placement="header" />} />
      <PageContainer>
        <div className="filter-toolbar gap-1.5">
          <SearchBar value={q} onChange={setQ} placeholder="Search sales…" />
          <div className="grid grid-cols-2 gap-1.5">
            <Select
              aria-label="Status"
              size="compact"
              pickerTitle="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as '' | DocStatus)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Payment"
              size="compact"
              pickerTitle="Payment method"
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as '' | PaymentMethod)}
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {!sales ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={(sales?.length ?? 0) === 0 ? 'No sales yet' : 'No matching sales'}
            description={
              (sales?.length ?? 0) === 0
                ? 'Record your first sale to get started.'
                : 'Try adjusting filters or search.'
            }
            action={
              (sales?.length ?? 0) === 0 ? (
                <Link to="/sales/new">
                  <Button type="button">Create first sale</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="list-shell">
            <div className="flex items-center justify-end border-b border-border-app/35 px-2.5 py-1">
              <span className="text-[10px] tabular-nums text-muted">
                {filtered.length} sale{filtered.length === 1 ? '' : 's'}
              </span>
            </div>
            {visibleRows.map((s) => {
              const PayIcon = PAYMENT_ICON[s.paymentMethod];
              return (
                <Link
                  key={s.id}
                  to={`/sales/${s.id}`}
                  className="block min-h-[52px] border-b border-border-app/35 px-2.5 py-2 last:border-0 active:bg-surface-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight text-foreground">
                        {s.customerName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] leading-tight text-muted">
                        <PayIcon className="h-3 w-3 shrink-0" aria-hidden />
                        {s.saleNumber} · {formatDisplayDate(s.date)} · {s.paymentMethod}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5 pt-0.5 text-right">
                      <MoneyDisplay
                        amount={saleInvoiceTotal(s)}
                        className="text-sm font-semibold leading-none tabular-nums"
                        tone={moneyToneForStatus(s.status, s.paymentMethod)}
                      />
                      <StatusPill status={s.status} />
                    </div>
                  </div>
                </Link>
              );
            })}
            {visible < filtered.length && (
              <button
                type="button"
                onClick={() => setVisible((n) => n + PAGE_SIZE)}
                className="w-full min-h-[48px] border-t border-border-app/35 py-3 text-sm font-medium text-brand-light active:bg-surface-hover"
              >
                Load more ({filtered.length - visible} remaining)
              </button>
            )}
          </div>
        )}
      </PageContainer>
      <FAB to="/sales/new" label="New sale" />
    </>
  );
}
