import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EntityNotFound } from '@/components/common/EntityNotFound';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { StatCard } from '@/components/common/StatCard';
import { EntityActions } from '@/components/common/EntityActions';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button, Field, FormDateInput, Input, QtyInput } from '@/components/common/Field';
import { Modal } from '@/components/common/Modal';
import { ProductForm } from '@/components/forms/ProductForm';
import { db } from '@/lib/db';
import { updateProduct } from '@/lib/entities';
import { multiplyMoney } from '@/lib/money';
import { adjustStock } from '@/lib/transactions';
import { stockAdjustmentSchema, type StockAdjustmentFormData } from '@/lib/validators';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function ProductDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const product = useLiveQuery(() => db.products.get(id), [id]);
  const movements = useLiveQuery(
    () => db.stockMovements.where('productId').equals(id).reverse().sortBy('date'),
    [id],
  );
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), newQty: 0, note: '' },
  });

  if (product === undefined) return <LoadingSpinner />;
  if (!product) return <EntityNotFound title="Product" backTo="/inventory" backLabel="Back to inventory" />;

  const onAdjust = async (data: StockAdjustmentFormData) => {
    try {
      await adjustStock({ productId: product.id, date: data.date, newQty: data.newQty, note: data.note });
      toast.success('Stock adjusted');
      setOpen(false);
      reset();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    }
  };

  const handleDelete = async () => {
    try {
      await updateProduct(product.id, { isActive: false });
      toast.success('Product removed');
      navigate('/inventory');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    } finally {
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <TopBar
        title={product.name}
        right={
          product.isActive ? (
            <EntityActions onEdit={() => setEditOpen(true)} onDelete={() => setDeleteOpen(true)} deleteLabel="Remove product" />
          ) : undefined
        }
      />
      <PageContainer>
        <div className="page-stack">
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Cost Price" amount={product.costPrice} />
            <StatCard label="Selling Price" amount={product.sellingPrice} tone="income" />
          </div>
          <div className="card">
            <p className="text-xs uppercase tracking-wider text-muted">In Stock</p>
            <p className="mt-1 hero-money text-foreground">
              {product.stockQty} <span className="text-sm font-normal text-muted">{product.unit}</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              Inventory value: <MoneyDisplay amount={multiplyMoney(product.costPrice, product.stockQty)} className="text-xs" />
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={() => {
              reset({ date: format(new Date(), 'yyyy-MM-dd'), newQty: product.stockQty, note: '' });
              setOpen(true);
            }}
          >
            Adjust Stock
          </Button>

          <div>
            <h2 className="mb-2 text-base font-semibold text-foreground">Stock Movements</h2>
            <div className="list-shell">
              {(movements ?? []).length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">No movements yet.</p>
              ) : (
                (movements ?? []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between border-b border-border-app px-3 py-2 last:border-0">
                    <div>
                      <p className="text-sm capitalize text-foreground">{m.type}</p>
                      <p className="text-xs text-muted">
                        {m.reference} · {m.date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${m.qtyChange >= 0 ? 'text-success' : 'text-danger'}`}>
                        {m.qtyChange >= 0 ? '+' : ''}
                        {m.qtyChange}
                      </p>
                      <p className="text-xs text-muted">bal {m.balanceAfter}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </PageContainer>

      <Modal open={open} onClose={() => setOpen(false)} title="Adjust Stock">
        <form onSubmit={handleSubmit(onAdjust)} className="page-stack">
          <Field label="Date" error={errors.date?.message}>
            <FormDateInput name="date" control={control} />
          </Field>
          <Field label="New Quantity" error={errors.newQty?.message}>
            <QtyInput min={0} {...register('newQty', { valueAsNumber: true })} />
          </Field>
          <Field label="Reason" error={errors.note?.message}>
            <Input {...register('note')} placeholder="e.g. physical count correction" />
          </Field>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            Save Adjustment
          </Button>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Product">
        <ProductForm product={product} onDone={() => setEditOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Remove this product?"
        message="It will be hidden from inventory lists. Past sales and stock history are kept."
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
