import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Field, FormDateInput, QtyInput, Select, Textarea } from '@/components/common/Field';
import { CustomerNameInput } from '@/components/forms/CustomerNameInput';
import { MoneyInput } from '@/components/common/MoneyInput';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { DraftBanner } from '@/components/common/DraftBanner';
import { db, activeWhere, type PaymentMethod } from '@/lib/db';
import { saleSchema, type SaleFormData } from '@/lib/validators';
import { recordSale } from '@/lib/transactions';
import { findOrCreateCustomer } from '@/lib/entities';
import { addMoney, multiplyMoney, subtractMoney, toINR } from '@/lib/money';
import { getErrorMessage } from '@/lib/errors';
import { useDraft, type DraftEnvelope } from '@/hooks/useDraft';
import { toast } from '@/store/useToast';

function isSaleDraftBlank(v: SaleFormData): boolean {
  return !v.customerName?.trim() && (!v.items || v.items.length === 0) && !v.notes?.trim();
}

function resolveSalePayment(
  channel: 'cash' | 'bank' | 'upi',
  paidAmount: number, // paise
  total: number, // paise
): { paymentMethod: PaymentMethod; paidAmount: number } {
  const paid = Math.min(Math.max(paidAmount, 0), total);
  if (paid === 0) return { paymentMethod: 'credit', paidAmount: 0 };
  if (paid < total) return { paymentMethod: 'partial', paidAmount: paid };
  return { paymentMethod: channel, paidAmount: total };
}

export default function NewSale() {
  const navigate = useNavigate();
  const activeProducts = useLiveQuery(() => activeWhere(db.products).toArray());
  const customers = useLiveQuery(() => activeWhere(db.customers).toArray());
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());

  const productList = activeProducts ?? [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      customerName: '',
      items: [],
      discount: 0,
      paymentMethod: 'cash',
      paidAmount: 0,
    },
  });

  const { loadDraft, saveDraft, clearDraft } = useDraft<SaleFormData>('new-sale', isSaleDraftBlank);
  const [draftPrompt, setDraftPrompt] = useState<DraftEnvelope<SaleFormData> | null>(null);

  useEffect(() => {
    setDraftPrompt(loadDraft());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const subscription = watch((values) => saveDraft(values as SaleFormData));
    return () => subscription.unsubscribe();
  }, [watch, saveDraft]);

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');
  const discount = watch('discount');
  const paymentMethod = watch('paymentMethod');
  const paidAmount = watch('paidAmount');
  const prevTotalRef = useRef(0);

  // Do not memoize on `items` — RHF mutates line items in place, so the array
  // reference stays stable while totals change and useMemo would stay stale.
  const subtotal = addMoney(
    ...(items ?? []).map(
      (i) => i.total || multiplyMoney(i.unitPrice || 0, i.qty || 0),
    ),
  );
  const total = Math.max(subtractMoney(subtotal, discount || 0), 0);
  const balanceDue = Math.max(subtractMoney(total, paidAmount || 0), 0);

  const paymentStatus =
    total <= 0
      ? null
      : paidAmount <= 0
        ? 'credit'
        : balanceDue > 0
          ? 'partial'
          : 'completed';

  useEffect(() => {
    const prev = prevTotalRef.current;
    const paid = paidAmount ?? 0;

    if (total > 0 && (paid === prev || (paid === 0 && prev === 0))) {
      setValue('paidAmount', total, { shouldValidate: true });
    } else if (paid > total) {
      setValue('paidAmount', total, { shouldValidate: true });
    }

    prevTotalRef.current = total;
  }, [total, paidAmount, setValue]);

  useEffect(() => {
    if ((discount ?? 0) > subtotal) {
      setValue('discount', subtotal, { shouldValidate: true });
    }
  }, [discount, subtotal, setValue]);

  const duplicateProductIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items ?? []) {
      if (item.productId) {
        counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1);
      }
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [items]);

  const addItem = () => {
    append({
      productId: '',
      productName: '',
      qty: 1,
      unitPrice: 0,
      costPrice: 0,
      total: 0,
    });
  };

  const onSubmit = async (data: SaleFormData) => {
    try {
      for (const item of data.items) {
        const product = await db.products.get(item.productId);
        if (!product?.isActive) {
          throw new Error(`Product not found: ${item.productName}`);
        }
        if (product.stockQty < item.qty) {
          throw new Error(
            `Insufficient stock for ${product.name} (have ${product.stockQty}, need ${item.qty})`,
          );
        }
      }

      const computedTotal = Math.max(
        subtractMoney(addMoney(...data.items.map((i) => i.total)), data.discount),
        0,
      );
      const { paymentMethod: resolvedMethod, paidAmount: resolvedPaid } = resolveSalePayment(
        data.paymentMethod,
        data.paidAmount,
        computedTotal,
      );

      const customer = await findOrCreateCustomer(data.customerName, data.customerId);

      const id = await recordSale({
        date: data.date,
        customerId: customer.id,
        customerName: customer.name,
        items: data.items,
        discount: data.discount,
        paymentMethod: resolvedMethod,
        bankAccountId: data.bankAccountId || undefined,
        paidAmount: resolvedPaid,
        notes: data.notes,
      });
      clearDraft();
      toast.success('Sale recorded');
      navigate(`/sales/${id}`);
    } catch (err) {
      console.error('[NewSale]', err);
      toast.error(getErrorMessage(err, 'Failed to record sale'));
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void handleSubmit(onSubmit)();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSubmit, onSubmit]);

  const needsBank =
    (paymentMethod === 'bank' || paymentMethod === 'upi') && (paidAmount ?? 0) > 0;

  return (
    <>
      <TopBar title="New Sale" />
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
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { label: 'Today', value: format(new Date(), 'yyyy-MM-dd') },
                { label: 'Yesterday', value: format(subDays(new Date(), 1), 'yyyy-MM-dd') },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setValue('date', opt.value, { shouldValidate: true })}
                  className="rounded-full border border-border-app/60 px-3 py-1 text-xs font-medium text-muted active:bg-surface-hover"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <CustomerNameInput
            value={watch('customerName')}
            customerId={watch('customerId')}
            onChange={(name, id) => {
              setValue('customerName', name, { shouldValidate: true });
              setValue('customerId', id);
            }}
            customers={customers ?? []}
            error={errors.customerName?.message}
          />

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
                <div
                  key={f.id}
                  className={`rounded-lg border p-3 ${
                    duplicateProductIds.has(items?.[i]?.productId ?? '')
                      ? 'border-warning/60 bg-warning/5'
                      : 'border-border-app'
                  }`}
                >
                  {duplicateProductIds.has(items?.[i]?.productId ?? '') && (
                    <p className="mb-2 flex items-center gap-1 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Same product on multiple lines — quantities will be combined
                    </p>
                  )}
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
                          setValue(`items.${i}.unitPrice`, p.sellingPrice);
                          setValue(`items.${i}.costPrice`, p.costPrice);
                          setValue(`items.${i}.total`, multiplyMoney(p.sellingPrice, items?.[i]?.qty || 1));
                        }
                      }}
                    >
                      <option value="">Select product</option>
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
                          const raw = e.target.value.replace(/\D/g, '');
                          const qty = Math.max(1, Number(raw) || 1);
                          setValue(`items.${i}.qty`, qty);
                          setValue(`items.${i}.total`, multiplyMoney(items?.[i]?.unitPrice || 0, qty));
                        }}
                        onBlur={(e) => {
                          const qty = Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1);
                          e.target.value = String(qty);
                          setValue(`items.${i}.qty`, qty);
                          setValue(`items.${i}.total`, multiplyMoney(items?.[i]?.unitPrice || 0, qty));
                        }}
                      />
                    </Field>
                    <Field label="Unit Price">
                      <MoneyInput
                        value={items?.[i]?.unitPrice ?? 0}
                        onChange={(v) => {
                          setValue(`items.${i}.unitPrice`, v);
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
              <MoneyDisplay amount={total} tone="income" />
            </div>
          </div>

          <div className="space-y-3 card">
            <Field label="Payment Method" error={errors.paymentMethod?.message}>
              <Select {...register('paymentMethod')}>
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="upi">UPI</option>
              </Select>
              <p className="mt-1.5 text-xs text-muted">
                Amount received below sets full, partial, or credit sale automatically.
              </p>
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

            <Field label="Amount Received" error={errors.paidAmount?.message}>
              <MoneyInput
                value={paidAmount ?? 0}
                onChange={(v) => setValue('paidAmount', v, { shouldValidate: true })}
              />
            </Field>

            {total > 0 && (
              <div className="space-y-2 rounded-lg bg-app px-3 py-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Balance due</span>
                  <MoneyDisplay
                    amount={balanceDue}
                    tone={balanceDue > 0 ? 'partial' : 'neutral'}
                    className="font-semibold"
                  />
                </div>
                {paymentStatus === 'completed' && (
                  <p className="text-xs text-success">Fully paid</p>
                )}
                {paymentStatus === 'partial' && (
                  <p className="text-xs text-warning">Partial payment — balance will be receivable</p>
                )}
                {paymentStatus === 'credit' && (
                  <p className="text-xs text-warning">Credit sale — full amount due from customer</p>
                )}
                {balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setValue('paidAmount', total, { shouldValidate: true })}
                    className="text-xs font-medium text-brand-light active:opacity-70"
                  >
                    Receive full amount ({toINR(total)})
                  </button>
                )}
              </div>
            )}
          </div>

          <Field label="Notes" error={errors.notes?.message}>
            <Textarea {...register('notes')} placeholder="Optional" />
          </Field>

          <Button type="submit" disabled={isSubmitting || total <= 0} className="w-full">
            Record Sale
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
