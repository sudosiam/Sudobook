import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Phone, User } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EntityNotFound } from '@/components/common/EntityNotFound';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { StatusPill } from '@/components/common/StatusPill';
import { EntityActions } from '@/components/common/EntityActions';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/common/Field';
import { PaymentModal } from '@/components/common/PaymentModal';
import { Modal } from '@/components/common/Modal';
import { CustomerForm } from '@/components/forms/CustomerForm';
import { db } from '@/lib/db';
import { updateCustomer } from '@/lib/entities';
import { getCustomerBalance } from '@/lib/reports';
import { receiveSalePayment } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function CustomerDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const customer = useLiveQuery(() => db.customers.get(id), [id]);
  const sales = useLiveQuery(
    () => db.sales.where('customerId').equals(id).reverse().sortBy('date'),
    [id],
  );
  const banks = useLiveQuery(() => db.bankAccounts.where('isActive').equals(1).toArray());
  const balance = useLiveQuery(async () => {
    await db.sales.count();
    return getCustomerBalance(id);
  }, [id]);

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saleId, setSaleId] = useState('');
  const [payDue, setPayDue] = useState(0);

  const outstanding = (sales ?? []).filter((s) => s.status !== 'void' && s.dueAmount > 0);

  if (customer === undefined) return <LoadingSpinner />;
  if (!customer) return <EntityNotFound title="Customer" backTo="/customers" backLabel="Back to customers" />;

  const openCollect = (sale: (typeof outstanding)[0]) => {
    setSaleId(sale.id);
    setPayDue(sale.dueAmount);
    setPayOpen(true);
  };

  const handleDelete = async () => {
    try {
      await updateCustomer(id, { isActive: false });
      toast.success('Customer removed');
      navigate('/customers');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    } finally {
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <TopBar
        title="Customer"
        right={
          customer.isActive ? (
            <EntityActions onEdit={() => setEditOpen(true)} onDelete={() => setDeleteOpen(true)} deleteLabel="Remove customer" />
          ) : undefined
        }
      />
      <PageContainer>
        <div className="page-stack">
          <div className="card">
            <p className="section-label">Outstanding Balance</p>
            <MoneyDisplay amount={balance ?? 0} tone="income" className="mt-1 block hero-money" />
          </div>

          <div className="flex min-h-[52px] items-start gap-2 rounded-xl border border-border-app bg-surface px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15">
              <User className="h-5 w-5 text-brand-light" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">Customer</p>
              <p className="truncate text-sm font-medium text-foreground">{customer.name}</p>
              <a
                href={`tel:${customer.phone}`}
                className="mt-1 inline-flex items-center gap-1 text-xs text-brand-light active:opacity-80"
              >
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </a>
              {customer.address && (
                <p className="mt-1 text-xs leading-relaxed text-muted">{customer.address}</p>
              )}
            </div>
          </div>

          <Link
            to={`/customers/${id}/statement`}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border-app bg-surface text-sm text-brand-light active:bg-surface-hover"
          >
            <FileText className="h-4 w-4" /> View Statement
          </Link>

          {outstanding.length > 0 && (
            <div>
              <h2 className="mb-2 text-base font-semibold text-foreground">Collect Payment</h2>
              <div className="list-shell">
                {outstanding.map((s) => (
                  <div
                    key={s.id}
                    className="flex min-h-[52px] items-center justify-between border-b border-border-app px-3 py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm text-foreground">{s.saleNumber}</p>
                      <p className="text-xs text-muted">{s.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoneyDisplay amount={s.dueAmount} tone="income" className="text-sm font-semibold" />
                      <Button className="min-h-[48px] px-3 py-2 text-xs" onClick={() => openCollect(s)}>
                        Collect
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">Sales History</h2>
            <div className="list-shell">
              {(sales ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">No sales yet.</p>
              ) : (
                (sales ?? []).map((s) => (
                  <Link
                    key={s.id}
                    to={`/sales/${s.id}`}
                    className="flex items-center justify-between border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
                  >
                    <div>
                      <p className="text-sm text-foreground">{s.saleNumber}</p>
                      <p className="text-xs text-muted">{s.date}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <MoneyDisplay amount={s.total} className="text-sm" />
                      <StatusPill status={s.status} />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </PageContainer>

      <PaymentModal
        open={payOpen}
        title="Collect Payment"
        maxDue={payDue}
        banks={banks ?? []}
        onClose={() => setPayOpen(false)}
        onSubmit={async (data) => {
          if (!saleId) return;
          try {
            await receiveSalePayment(saleId, {
              date: data.date,
              amount: data.amount,
              method: data.method,
              bankAccountId: data.method === 'cash' ? undefined : data.bankAccountId,
            });
            toast.success('Payment received');
            setSaleId('');
            setPayDue(0);
          } catch (err) {
            console.error('[CustomerDetail.handlePay]', err);
            toast.error(getErrorMessage(err, 'Failed'));
            throw err;
          }
        }}
      />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Customer">
        <CustomerForm customer={customer} onDone={() => setEditOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Remove this customer?"
        message="They will be hidden from lists. Past sales and balances are kept for records."
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
