import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { Calendar, ChevronRight, CreditCard, Truck } from 'lucide-react';
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
import { db, activeWhere } from '@/lib/db';
import { PAYMENT_LABELS } from '@/lib/labels';
import { payPurchase, voidPurchase } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function PurchaseDetail() {
  const { id = '' } = useParams();
  const purchase = useLiveQuery(() => db.purchases.get(id), [id]);
  const bankAccount = useLiveQuery(
    () => (purchase?.bankAccountId ? db.bankAccounts.get(purchase.bankAccountId) : undefined),
    [purchase?.bankAccountId],
  );
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());
  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  if (purchase === undefined) return <LoadingSpinner />;
  if (!purchase) return <EntityNotFound title="Purchase" backTo="/purchases" backLabel="Back to purchases" />;

  const formattedDate = format(parseISO(purchase.date), 'd MMM yyyy');

  const handleVoid = async (reason?: string) => {
    if (voiding || !reason) return;
    setVoiding(true);
    try {
      await voidPurchase(purchase.id, reason);
      toast.success('Purchase voided');
      setVoidOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <>
      <TopBar
        title={purchase.purchaseNumber}
        right={
          purchase.status !== 'void' ? (
            <EntityActions onDelete={() => setVoidOpen(true)} deleteLabel="Void purchase" />
          ) : undefined
        }
      />
      <PageContainer>
        <div className="page-stack">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="section-label">Purchase Total</p>
                <MoneyDisplay
                  amount={purchase.total}
                  className="mt-1 block hero-money"
                  tone={docAmountTone(purchase.status, purchase.paymentMethod)}
                />
              </div>
              <StatusPill status={purchase.status} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
              <span className="text-disabled">·</span>
              <span className="inline-flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5" />
                {PAYMENT_LABELS[purchase.paymentMethod]}
                {bankAccount ? ` · ${bankAccount.name}` : ''}
              </span>
            </div>
          </div>

          <Link
            to={`/vendors/${purchase.vendorId}`}
            className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15">
              <Truck className="h-5 w-5 text-brand-light" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Vendor</p>
              <p className="truncate text-sm font-medium text-foreground">{purchase.vendorName}</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-disabled" />
          </Link>

          {purchase.status !== 'void' && purchase.dueAmount > 0 && (
            <div className="card-accent flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-warning">Amount Due</p>
                <p className="mt-0.5 text-xs text-muted">Outstanding to vendor</p>
              </div>
              <MoneyDisplay amount={purchase.dueAmount} tone={docDueTone(purchase.status, purchase.paymentMethod)} className="text-lg font-semibold" />
            </div>
          )}

          <div>
            <h2 className="section-label mb-2">Items</h2>
            <div className="list-shell">
              {purchase.items.map((it, idx) => (
                <div
                  key={idx}
                  className="flex min-h-[64px] items-center justify-between gap-3 border-b border-border-app px-4 py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{it.productName}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {it.qty} × <MoneyDisplay amount={it.unitCost} className="text-xs" />
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
              <Row label="Subtotal" amount={purchase.subtotal} />
              <Row label="Total" amount={purchase.total} bold />
              <Row label="Paid" amount={purchase.paidAmount} />
              <Row label="Due" amount={purchase.dueAmount} tone={purchase.dueAmount > 0 ? docDueTone(purchase.status, purchase.paymentMethod) : 'neutral'} />
            </div>
          </div>

          {purchase.notes && (
            <div className="card">
              <p className="section-label">Notes</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{purchase.notes}</p>
            </div>
          )}

          {purchase.status !== 'void' && (
            <div className="flex gap-2 pt-1">
              {purchase.dueAmount > 0 && (
                <Button className="flex-1" onClick={() => setPayOpen(true)}>
                  Pay Vendor
                </Button>
              )}
              <Button variant="danger" className="flex-1" onClick={() => setVoidOpen(true)}>
                Void Purchase
              </Button>
            </div>
          )}
        </div>
      </PageContainer>

      <ConfirmDialog
        open={voidOpen}
        title="Void this purchase?"
        message="Stock will be reversed and the journal entry voided. This cannot be undone."
        confirmLabel="Void"
        danger
        requireReason
        reasonPlaceholder="Why is this purchase being voided?"
        onConfirm={handleVoid}
        onCancel={() => setVoidOpen(false)}
      />

      <PaymentModal
        open={payOpen}
        title="Pay Vendor"
        maxDue={purchase.dueAmount}
        banks={banks ?? []}
        onClose={() => setPayOpen(false)}
        submitLabel="Confirm Payment"
        onSubmit={async (data) => {
          try {
            await payPurchase(purchase.id, {
              date: data.date,
              amount: data.amount,
              method: data.method,
              bankAccountId: data.method === 'cash' ? undefined : data.bankAccountId,
            });
            toast.success('Payment made');
          } catch (err) {
            console.error('[PurchaseDetail.handlePay]', err);
            toast.error(getErrorMessage(err, 'Failed'));
            throw err;
          }
        }}
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
