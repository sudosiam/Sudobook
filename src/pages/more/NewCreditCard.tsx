import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { AdjustmentEntryList } from '@/components/more/AdjustmentEntryList';
import { AccountCategorySelect } from '@/components/common/AccountCategorySelect';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { FAB } from '@/components/common/FAB';
import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { useSelectableExpenseAccounts } from '@/hooks/useAccountCategories';
import { db, activeWhere } from '@/lib/db';
import { creditCardSchema, type CreditCardFormData } from '@/lib/validators';
import {
  getCreditCardEditDefaults,
  listCreditCardRecords,
  type AdjustmentListItem,
} from '@/lib/adjustmentRecords';
import {
  recordCreditCardCharge,
  recordCreditCardPayment,
  updateCreditCardEntry,
  voidAdjustmentRecord,
} from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

const DEFAULTS: CreditCardFormData = {
  kind: 'payment',
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  amount: 0,
  paidFrom: 'bank',
};

export default function NewCreditCard() {
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());
  const expenseAccounts = useSelectableExpenseAccounts();
  const items = useLiveQuery(() => listCreditCardRecords(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdjustmentListItem | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: DEFAULTS,
  });

  const kind = watch('kind');
  const paidFrom = watch('paidFrom');
  const amount = watch('amount');
  const accountCode = watch('accountCode');

  const openAdd = () => {
    setEditingId(null);
    reset({ ...DEFAULTS, date: format(new Date(), 'yyyy-MM-dd'), bankAccountId: '' });
    setFormOpen(true);
  };

  const openEdit = async (item: AdjustmentListItem) => {
    try {
      const data = await getCreditCardEditDefaults(item.linkedId);
      if (!data) {
        toast.error('Could not load entry');
        return;
      }
      setEditingId(item.linkedId);
      reset(data);
      setFormOpen(true);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load entry'));
    }
  };

  const onSubmit = async (data: CreditCardFormData) => {
    try {
      if (editingId) {
        await updateCreditCardEntry(editingId, data);
        toast.success('Credit card entry updated');
      } else if (data.kind === 'payment') {
        await recordCreditCardPayment({
          date: data.date,
          description: data.description,
          amount: data.amount,
          paidFrom: data.paidFrom ?? 'bank',
          bankAccountId: data.bankAccountId || undefined,
        });
        toast.success('Credit card payment recorded');
      } else {
        await recordCreditCardCharge({
          date: data.date,
          description: data.description,
          amount: data.amount,
          accountCode: data.accountCode!,
        });
        toast.success('Credit card expense recorded');
      }
      setFormOpen(false);
      setEditingId(null);
    } catch (err) {
      console.error('[NewCreditCard]', err);
      toast.error(getErrorMessage(err, 'Failed to save credit card entry'));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await voidAdjustmentRecord(deleteTarget.linkedId, 'Removed');
      toast.success('Entry removed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove entry'));
    } finally {
      setDeleteTarget(null);
    }
  };

  if (items === undefined) return <LoadingSpinner />;

  return (
    <>
      <TopBar title="Credit Card" />
      <PageContainer>
        <AdjustmentEntryList
          items={items}
          emptyIcon={CreditCard}
          emptyTitle="No credit card entries yet"
          onEdit={(item) => void openEdit(item)}
          onDelete={setDeleteTarget}
        />
      </PageContainer>

      <FAB onClick={openAdd} label="Add credit card entry" />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Credit Card Entry' : 'Add Credit Card Entry'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
          <Field label="Type" error={errors.kind?.message}>
            <Select {...register('kind')}>
              <option value="payment">Pay card bill</option>
              <option value="charge">Expense on card</option>
            </Select>
          </Field>

          <Field label="Date" error={errors.date?.message}>
            <FormDateInput name="date" control={control} />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Input {...register('description')} placeholder="e.g. HDFC card bill, fuel on card" />
          </Field>

          <Field label="Amount" error={errors.amount?.message}>
            <MoneyInput value={amount} onChange={(v) => setValue('amount', v)} />
          </Field>

          {kind === 'charge' ? (
            <Field label="Expense Category" error={errors.accountCode?.message}>
              <AccountCategorySelect
                accounts={expenseAccounts}
                value={accountCode}
                onChange={(code) => setValue('accountCode', code, { shouldValidate: true })}
              />
            </Field>
          ) : (
            <>
              <Field label="Paid From" error={errors.paidFrom?.message}>
                <Select {...register('paidFrom')}>
                  <option value="cash">Cash in Hand</option>
                  <option value="bank">Bank / UPI</option>
                </Select>
              </Field>

              {paidFrom === 'bank' && (
                <Field label="Bank Account" error={errors.bankAccountId?.message}>
                  <Select {...register('bankAccountId')}>
                    <option value="">Select account</option>
                    {(banks ?? [])
                      .filter((b) => b.accountType !== 'cash')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              )}
            </>
          )}

          <Button type="submit" disabled={isSubmitting || amount <= 0} className="w-full">
            {editingId ? 'Save Changes' : kind === 'payment' ? 'Record Payment' : 'Record Expense'}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this entry?"
        message="The journal entry will be voided and balances updated. This cannot be undone."
        confirmLabel="Remove"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
