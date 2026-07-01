import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, Phone } from 'lucide-react';
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
import { VendorForm } from '@/components/forms/VendorForm';
import { db } from '@/lib/db';
import { updateVendor } from '@/lib/entities';
import { getVendorBalance } from '@/lib/reports';
import { payPurchase } from '@/lib/transactions';
import { toast } from '@/store/useToast';

export default function VendorDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const vendor = useLiveQuery(() => db.vendors.get(id), [id]);
  const purchases = useLiveQuery(
    () => db.purchases.where('vendorId').equals(id).reverse().sortBy('date'),
    [id],
  );
  const banks = useLiveQuery(() => db.bankAccounts.filter((b) => b.isActive).toArray());
  const balance = useLiveQuery(async () => {
    await db.purchases.count();
    return getVendorBalance(id);
  }, [id]);

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [purchaseId, setPurchaseId] = useState('');
  const [payDue, setPayDue] = useState(0);

  const outstanding = (purchases ?? []).filter((p) => p.status !== 'void' && p.dueAmount > 0);

  if (vendor === undefined) return <LoadingSpinner />;
  if (!vendor) return <EntityNotFound title="Vendor" backTo="/vendors" backLabel="Back to vendors" />;

  const openPay = (purchase: (typeof outstanding)[0]) => {
    setPurchaseId(purchase.id);
    setPayDue(purchase.dueAmount);
    setPayOpen(true);
  };

  const handleDelete = async () => {
    try {
      await updateVendor(id, { isActive: false });
      toast.success('Vendor removed');
      navigate('/vendors');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    } finally {
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <TopBar
        title={vendor.name}
        right={
          vendor.isActive ? (
            <EntityActions onEdit={() => setEditOpen(true)} onDelete={() => setDeleteOpen(true)} deleteLabel="Remove vendor" />
          ) : undefined
        }
      />
      <PageContainer>
        <div className="page-stack">
          <div className="card">
            <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 text-sm text-brand-light">
              <Phone className="h-4 w-4" /> {vendor.phone}
            </a>
            {vendor.company && <p className="mt-2 text-sm text-muted">{vendor.company}</p>}
            {vendor.address && <p className="mt-1 text-sm text-muted">{vendor.address}</p>}
          </div>

          <div className="card">
            <p className="text-xs uppercase tracking-wider text-muted">Outstanding Payable</p>
            <MoneyDisplay amount={balance ?? 0} tone="expense" className="mt-1 block hero-money" />
          </div>

          <Link
            to={`/vendors/${id}/statement`}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border-app bg-surface text-sm text-brand-light active:bg-surface-hover"
          >
            <FileText className="h-4 w-4" /> View Statement
          </Link>

          {outstanding.length > 0 && (
            <div>
              <h2 className="mb-2 text-base font-semibold text-foreground">Pay Vendor</h2>
              <div className="list-shell">
                {outstanding.map((p) => (
                  <div
                    key={p.id}
                    className="flex min-h-[52px] items-center justify-between border-b border-border-app px-3 py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm text-foreground">{p.purchaseNumber}</p>
                      <p className="text-xs text-muted">{p.date}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoneyDisplay amount={p.dueAmount} tone="expense" className="text-sm font-semibold" />
                      <Button className="min-h-[48px] px-3 py-2 text-xs" onClick={() => openPay(p)}>
                        Pay
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">Purchase History</h2>
            <div className="list-shell">
              {(purchases ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">No purchases yet.</p>
              ) : (
                (purchases ?? []).map((p) => (
                  <Link
                    key={p.id}
                    to={`/purchases/${p.id}`}
                    className="flex items-center justify-between border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
                  >
                    <div>
                      <p className="text-sm text-foreground">{p.purchaseNumber}</p>
                      <p className="text-xs text-muted">{p.date}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <MoneyDisplay amount={p.total} className="text-sm" />
                      <StatusPill status={p.status} />
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
        title="Pay Vendor"
        maxDue={payDue}
        banks={banks ?? []}
        onClose={() => setPayOpen(false)}
        onSubmit={async (data) => {
          if (!purchaseId) return;
          try {
            await payPurchase(purchaseId, {
              date: data.date,
              amount: data.amount,
              method: data.method,
              bankAccountId: data.method === 'cash' ? undefined : data.bankAccountId,
            });
            toast.success('Payment made');
            setPurchaseId('');
            setPayDue(0);
          } catch (err) {
            console.error('[VendorDetail.handlePay]', err);
            toast.error(err instanceof Error ? err.message : 'Failed');
            throw err;
          }
        }}
      />

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Vendor">
        <VendorForm vendor={vendor} onDone={() => setEditOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Remove this vendor?"
        message="They will be hidden from lists. Past purchases and payables are kept for records."
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
