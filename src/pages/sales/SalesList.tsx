import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { VirtualList } from '@/components/common/VirtualList';
import { Select, Button } from '@/components/common/Field';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useStaleLiveQuery } from '@/hooks/useStaleLiveQuery';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';
import { type DocStatus, type PaymentMethod, type Sale } from '@/lib/db';
import { countSalesInRange, LIST_PAGE_SIZE, querySalesPage } from '@/lib/listQueries';
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

export default function SalesList() {
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q);
  const [statusFilter, setStatusFilter] = useState<'' | DocStatus>('');
  const [paymentFilter, setPaymentFilter] = useState<'' | PaymentMethod>('');
  const [limit, setLimit] = useState(LIST_PAGE_SIZE);
  const { mode, year, month, setMode } = usePeriodStore();
  const range = periodRange({ mode, year, month });

  useEffect(() => {
    setMode('fy');
  }, [setMode]);

  useEffect(() => {
    setLimit(LIST_PAGE_SIZE);
  }, [debouncedQ, statusFilter, paymentFilter, range?.start, range?.end]);

  const queryKey = `${range?.start ?? 'all'}:${range?.end ?? ''}:${debouncedQ}:${statusFilter}:${paymentFilter}:${limit}`;

  const sales = useStaleLiveQuery(
    () => querySalesPage(limit + 1, range, statusFilter, paymentFilter, debouncedQ),
    [queryKey],
  );

  const hasFilters = Boolean(debouncedQ || statusFilter || paymentFilter);
  const totalInRange = useStaleLiveQuery(
    () => (hasFilters ? Promise.resolve(null) : countSalesInRange(range)),
    [range?.start, range?.end, hasFilters],
  );

  const rows = useMemo(() => (sales ?? []).slice(0, limit), [sales, limit]);
  const hasMore = (sales?.length ?? 0) > limit;
  const isInitialLoad = sales === undefined;

  const countLabel = useMemo(() => {
    if (hasFilters) {
      return `${rows.length}${hasMore ? '+' : ''} sale${rows.length === 1 ? '' : 's'}`;
    }
    if (totalInRange != null) {
      return `${totalInRange} sale${totalInRange === 1 ? '' : 's'}`;
    }
    return `${rows.length}${hasMore ? '+' : ''} sale${rows.length === 1 ? '' : 's'}`;
  }, [hasFilters, rows.length, hasMore, totalInRange]);

  return (
    <>
      <TopBar title="Sales" right={<PeriodFilter placement="header" modes={['month', 'fy', 'all']} />} />
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
        {isInitialLoad ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title={hasFilters ? 'No matching sales' : 'No sales yet'}
            action={
              !hasFilters ? (
                <Link to="/sales/new">
                  <Button type="button">Create first sale</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="mb-1 flex items-center justify-end px-1">
              <span className="text-[10px] tabular-nums text-muted">{countLabel}</span>
            </div>
            <VirtualList
              items={rows}
              estimateSize={56}
              getKey={(s) => s.id}
              hasMore={hasMore}
              onLoadMore={() => setLimit((n) => n + LIST_PAGE_SIZE)}
              renderItem={(s: Sale) => {
                const PayIcon = PAYMENT_ICON[s.paymentMethod];
                return (
                  <Link
                    to={`/sales/${s.id}`}
                    className="block min-h-[52px] px-2.5 py-2 active:bg-surface-hover"
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
              }}
            />
          </>
        )}
      </PageContainer>
      <FAB to="/sales/new" label="New sale" />
    </>
  );
}
