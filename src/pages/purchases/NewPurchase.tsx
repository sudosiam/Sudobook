import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Field, FormDateInput, QtyInput, Select, Textarea } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { DraftBanner } from '@/components/common/DraftBanner';
import { db, activeWhere } from '@/lib/db';
import { purchaseSchema, type PurchaseFormData } from '@/lib/validators';
import { recordPurchase } from '@/lib/transactions';
import { addMoney, multiplyMoney, subtractMoney } from '@/lib/money';
import { getErrorMessage } from '@/lib/errors';
import { useDraft, type DraftEnvelope } from '@/hooks/useDraft';
import { toast } from '@/store/useToast';

function isPurchaseDraftBlank(v: PurchaseFormData): boolean {
  return !v.vendorId && (!v.items || v.items.length === 0) && !v.notes?.trim();
}

export default function NewPurchase() {
  const navigate = useNavigate();
  const products = useLiveQuery(() => activeWhere(db.products).toArray());
  const vendors = useLiveQuery(() => activeWhere(db.vendors).toArray());
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());
  const productList = products ?? [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      vendorId: '',
      vendorName: '',
      items: [],
      discount: 0,
      paymentMethod: 'cash',
      paidAmount: 0,
    },
  });

  const { loadDraft, saveDraft, clearDraft } = useDraft<PurchaseFormData>('new-purchase', isPurchaseDraftBlank);
  const [draftPrompt, setDraftPrompt] = useState<DraftEnvelope<PurchaseFormData> | null>(null);

  useEffect(() => {
    setDraftPrompt(loadDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = watch((values) => saveDraft(values as PurchaseFormData));
    return () => subscription.unsubscribe();
  }, [watch, saveDraft]);

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const discount = watch('discount');
  const paymentMethod = watch('paymentMethod');
  const subtotal = addMoney(
    ...(items ?? []).map(
      (i) => i.total || multiplyMoney(i.unitCost || 0, i.qty || 0),
    ),
  );
  const total = Math.max(subtractMoney(subtotal, discount || 0), 0);

  useEffect(() => {
    if ((discount ?? 0) > subtotal) {
      setValue('discount', subtotal, { shouldValidate: true });
    }
  }, [discount, subtotal, setValue]);

  const paidAmount = watch('paidAmount');
  useEffect(() => {
    if (paymentMethod === 'partial' && (paidAmount ?? 0) > total && total > 0) {
      setValue('paidAmount', total, { shouldValidate: true });
    }
  }, [paidAmount, total, paymentMethod, setValue]);

  const addItem = () => {
    const p = productList[0];
    append({
      productId: p?.id ?? '',
      productName: p?.name ?? '',
      qty: 1,
      unitCost: p?.costPrice ?? 0,
      total: p?.costPrice ?? 0,
    });
  };

  const onSubmit = async (data: PurchaseFormData) => {
    try {
      const lineSubtotal = addMoney(...data.items.map((i) => i.total));
      const invoiceTotal = Math.max(subtractMoney(lineSubtotal, data.discount), 0);
      const paidAmount =
        data.paymentMethod === 'credit'
          ? 0
          : data.paymentMethod === 'partial'
            ? data.paidAmount
            : invoiceTotal;
      const id = await recordPurchase({
        date: data.date,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        items: data.items,
        discount: data.discount,
        paymentMethod: data.paymentMethod,
        bankAccountId: data.bankAccountId || undefined,
        paidAmount,
        notes: data.notes,
      });
      clearDraft();
      toast.success('Purchase recorded');
      navigate(`/purchases/${id}`);
    } catch (err) {
      console.error('[NewPurchase]', err);
      toast.error(getErrorMessage(err, 'Failed to record purchase'));
    }
  };

  const needsBank = paymentMethod === 'bank' || paymentMethod === 'upi';

  return (
    <>
      <TopBar title="New Purchase" />
      <PageContainer>
        {draftPrompt && (
          <div className="mb-3">
            <DraftBanner
              savedAt={draftPrompt.savedAt}
              onRestore={() => {
                reset(draftPrompt.values);
                setDraftPrompt(null);
              }}
              onDiscard={() => {
                clearDraft();
                setDraftPrompt(null);
              }}
            />
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
          <Field label="Date" error={errors.date?.message}>
            <FormDateInput name="date" control={control} />
          </Field>

          <Field label="Vendor" error={errors.vendorId?.message}>
            <Select
              {...register('vendorId')}
              onChange={(e) => {
                const v = vendors?.find((x) => x.id === e.target.value);
                setValue('vendorId', e.target.value);
                if (v) setValue('vendorName', v.name);
              }}
            >
              <option value="">Select vendor</option>
              {(vendors ?? []).map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Items</h2>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs text-brand-light">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>
            {productList.length === 0 && (
              <p className="text-xs text-warning">Add products in Inventory first.</p>
            )}
            {errors.items?.message && <p className="mb-2 text-xs text-danger">{errors.items.message}</p>}
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={f.id} className="rounded-lg border border-border-app p-3">
                  <div className="mb-2 flex min-w-0 items-center gap-2">
                    <Select
                      className="min-w-0 flex-1"
                      pickerTitle="Product"
                      value={items?.[i]?.productId ?? ''}
                      onChange={(e) => {
                        const p = productList.find((x) => x.id === e.target.value);
                        if (p) {
                          setValue(`items.${i}.productId`, p.id);
                          setValue(`items.${i}.productName`, p.name);
                          setValue(`items.${i}.unitCost`, p.costPrice);
                          setValue(`items.${i}.total`, multiplyMoney(p.costPrice, items?.[i]?.qty || 1));
                        }
                      }}
                    >
                      {productList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.stockQty})
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-danger hover:bg-surface-hover"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Qty">
                      <QtyInput
                        value={items?.[i]?.qty ?? 1}
                        onChange={(e) => {
                          const qty = Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1);
                          setValue(`items.${i}.qty`, qty);
                          setValue(`items.${i}.total`, multiplyMoney(items?.[i]?.unitCost || 0, qty));
                        }}
                      />
                    </Field>
                    <Field label="Unit Cost">
                      <MoneyInput
                        value={items?.[i]?.unitCost ?? 0}
                        onChange={(v) => {
                          setValue(`items.${i}.unitCost`, v);
                          setValue(`items.${i}.total`, multiplyMoney(v, items?.[i]?.qty || 1));
                        }}
                      />
                    </Field>
                  </div>
                  <div className="mt-2 flex justify-end text-xs text-muted">
                    Line total:{' '}
                    <MoneyDisplay amount={items?.[i]?.total ?? 0} className="ml-1 text-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 card">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <MoneyDisplay amount={subtotal} />
            </div>
            <Field label="Discount" error={errors.discount?.message}>
              <MoneyInput value={discount} onChange={(v) => setValue('discount', v)} />
            </Field>
            <div className="flex items-center justify-between border-t border-border-app pt-3 text-base font-semibold">
              <span className="text-foreground">Total</span>
              <MoneyDisplay amount={total} tone="expense" />
            </div>
          </div>

          <Field label="Payment Method" error={errors.paymentMethod?.message}>
            <Select {...register('paymentMethod')}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="upi">UPI</option>
              <option value="partial">Partial</option>
              <option value="credit">Credit (unpaid)</option>
            </Select>
          </Field>

          {needsBank && (
            <Field label="Bank Account" error={errors.bankAccountId?.message}>
              <Select {...register('bankAccountId')}>
                <option value="">Select account</option>
                {(banks ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {paymentMethod === 'partial' && (
            <Field label="Amount Paid Now" error={errors.paidAmount?.message}>
              <MoneyInput value={watch('paidAmount')} onChange={(v) => setValue('paidAmount', v)} />
            </Field>
          )}

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register('notes')} placeholder="Optional" />
          </Field>

          <Button type="submit" disabled={isSubmitting || total <= 0} className="w-full">
            Record Purchase
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
