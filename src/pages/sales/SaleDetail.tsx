import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { Calendar, ChevronRight, CreditCard, User } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EntityNotFound } from '@/components/common/EntityNotFound';
import { MoneyDisplay, docAmountTone, docDueTone, type MoneyTone } from '@/components/common/MoneyDisplay';
import { StatusPill } from '@/components/common/StatusPill';
import { Button } from '@/components/common/Field';
import { PaymentModal } from '@/components/common/PaymentModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EntityActions } from '@/components/common/EntityActions';
import { db } from '@/lib/db';
import { PAYMENT_LABELS } from '@/lib/labels';
import { saleCogs, saleGrossMarginPct, saleGrossProfit } from '@/lib/sales';
import { receiveSalePayment, voidSale } from '@/lib/transactions';
import { toast } from '@/store/useToast';

export default function SaleDetail() {
  const { id = '' } = useParams();
  const sale = useLiveQuery(() => db.sales.get(id), [id]);
  const bankAccount = useLiveQuery(
    () => (sale?.bankAccountId ? db.bankAccounts.get(sale.bankAccountId) : undefined),
    [sale?.bankAccountId],
  );
  const banks = useLiveQuery(() => db.bankAccounts.filter((b) => b.isActive).toArray());
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  if (sale === undefined) return <LoadingSpinner />;
  if (!sale) return <EntityNotFound title="Sale" backTo="/sales" backLabel="Back to sales" />;

  const formattedDate = format(parseISO(sale.date), 'd MMM yyyy');

  const handleVoid = async () => {
    if (voiding) return;
    setVoiding(true);
    try {
      await voidSale(sale.id, 'Voided by user');
      toast.success('Sale voided');
      setVoidOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setVoiding(false);
    }
  };

  const cogs = saleCogs(sale);
  const grossProfit = saleGrossProfit(sale);
  const marginPct = saleGrossMarginPct(sale);

  return (
    <>
      <TopBar
        title={sale.saleNumber}
        right={
          sale.status !== 'void' ? (
            <EntityActions onDelete={() => setVoidOpen(true)} deleteLabel="Void sale" />
          ) : undefined
        }
      />
      <PageContainer>
        <div className="page-stack">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="section-label">Sale Total</p>
                <MoneyDisplay
                  amount={sale.total}
                  className="mt-1 block hero-money"
                  tone={docAmountTone(sale.status, sale.paymentMethod)}
                />
              </div>
              <StatusPill status={sale.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
              <span className="text-disabled">·</span>
              <span className="inline-flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                {PAYMENT_LABELS[sale.paymentMethod]}
                {bankAccount ? ` · ${bankAccount.name}` : ''}
              </span>
            </div>
          </div>

          {sale.customerId ? (
            <Link
              to={`/customers/${sale.customerId}`}
              className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15">
                <User className="h-5 w-5 text-brand-light" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">Customer</p>
                <p className="truncate text-sm font-medium text-foreground">{sale.customerName}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-disabled" />
            </Link>
          ) : (
            <div className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border-app bg-surface px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15">
                <User className="h-5 w-5 text-brand-light" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">Customer</p>
                <p className="truncate text-sm font-medium text-foreground">{sale.customerName}</p>
              </div>
            </div>
          )}

          {sale.status !== 'void' && sale.dueAmount > 0 && (
            <div className="card-accent flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-warning">Amount Due</p>
                <p className="mt-0.5 text-xs text-muted">Outstanding on this sale</p>
              </div>
              <MoneyDisplay amount={sale.dueAmount} tone={docDueTone(sale.status, sale.paymentMethod)} className="text-lg font-semibold" />
            </div>
          )}

          <div>
            <h2 className="section-label mb-2">Items</h2>
            <div className="list-shell">
              {sale.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex min-h-[64px] items-center justify-between gap-3 border-b border-border-app px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{it.productName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {it.qty} × <MoneyDisplay amount={it.unitPrice} className="text-xs" />
                    </p>
                  </div>
                  <MoneyDisplay amount={it.total} className="shrink-0 text-sm font-semibold" />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="section-label mb-2">Summary</h2>
            <div className="card space-y-2 text-sm">
              <Row label="Subtotal" amount={sale.subtotal} />
              {sale.discount > 0 && <Row label="Discount" amount={sale.discount} />}
              <Row label="Total" amount={sale.total} bold />
              {sale.status !== 'void' && (
                <>
                  <Row label="COGS" amount={cogs} />
                  <Row label={`Gross Profit (${marginPct}%)`} amount={grossProfit} bold tone="profit" />
                </>
              )}
              <Row label="Paid" amount={sale.paidAmount} />
              <Row label="Due" amount={sale.dueAmount} tone={sale.dueAmount > 0 ? docDueTone(sale.status, sale.paymentMethod) : 'neutral'} />
            </div>
          </div>

          {sale.notes && (
            <div className="card">
              <p className="section-label">Notes</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{sale.notes}</p>
            </div>
          )}

          {sale.status !== 'void' && (
            <div className="flex gap-2 pt-1">
              {sale.dueAmount > 0 && (
                <Button className="flex-1" onClick={() => setPayOpen(true)}>
                  Receive Payment
                </Button>
              )}
              <Button variant="danger" className="flex-1" onClick={() => setVoidOpen(true)}>
                Void Sale
              </Button>
            </div>
          )}
        </div>
      </PageContainer>

      <PaymentModal
        open={payOpen}
        title="Receive Payment"
        maxDue={sale.dueAmount}
        banks={banks ?? []}
        onClose={() => setPayOpen(false)}
        submitLabel="Confirm Payment"
        onSubmit={async (data) => {
          try {
            await receiveSalePayment(sale.id, {
              date: data.date,
              amount: data.amount,
              method: data.method,
              bankAccountId: data.method === 'cash' ? undefined : data.bankAccountId,
            });
            toast.success('Payment received');
          } catch (err) {
            console.error('[SaleDetail.handlePay]', err);
            toast.error(err instanceof Error ? err.message : 'Failed');
            throw err;
          }
        }}
      />

      <ConfirmDialog
        open={voidOpen}
        title="Void this sale?"
        message="This posts a reversing entry and restores stock. The record is kept for audit."
        confirmLabel="Void"
        danger
        onConfirm={handleVoid}
        onCancel={() => setVoidOpen(false)}
      />
    </>
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
    <div className={`flex items-center justify-between ${bold ? 'border-t border-border-app pt-2 font-semibold' : ''}`}>
      <span className={bold ? 'text-foreground' : 'text-muted'}>{label}</span>
      <MoneyDisplay amount={amount} tone={tone} className={bold ? 'text-base' : undefined} />
    </div>
  );
}
