import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { format } from 'date-fns';
import { Landmark } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { AdjustmentEntryList } from '@/components/more/AdjustmentEntryList';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { FAB } from '@/components/common/FAB';
import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { db, activeWhere } from '@/lib/db';
import { loanMovementSchema, type LoanMovementFormData } from '@/lib/validators';
import { getLoanEditDefaults, listLoanRecords, type AdjustmentListItem } from '@/lib/adjustmentRecords';
import { recordLoanReceived, recordLoanRepayment, updateLoanMovement, voidAdjustmentRecord } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

const DEFAULTS: LoanMovementFormData = {
  kind: 'receive',
  date: format(new Date(), 'yyyy-MM-dd'),
  description: '',
  amount: 0,
  paidFrom: 'bank',
};

export default function NewLoan() {
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());
  const items = useLiveQuery(() => listLoanRecords(), []);

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
  } = useForm<LoanMovementFormData>({
    resolver: zodResolver(loanMovementSchema),
    defaultValues: DEFAULTS,
  });

  const kind = watch('kind');
  const paidFrom = watch('paidFrom');
  const amount = watch('amount');

  const openAdd = () => {
    setEditingId(null);
    reset({ ...DEFAULTS, date: format(new Date(), 'yyyy-MM-dd'), bankAccountId: '' });
    setFormOpen(true);
  };

  const openEdit = async (item: AdjustmentListItem) => {
    try {
      const data = await getLoanEditDefaults(item.linkedId);
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

  const onSubmit = async (data: LoanMovementFormData) => {
    try {
      if (editingId) {
        await updateLoanMovement(editingId, data);
        toast.success('Loan entry updated');
      } else {
        const payload = {
          date: data.date,
          description: data.description,
          amount: data.amount,
          paidFrom: data.paidFrom,
          bankAccountId: data.bankAccountId || undefined,
        };
        if (data.kind === 'receive') await recordLoanReceived(payload);
        else await recordLoanRepayment(payload);
        toast.success(data.kind === 'receive' ? 'Loan recorded' : 'Loan repayment recorded');
      }
      setFormOpen(false);
      setEditingId(null);
    } catch (err) {
      console.error('[NewLoan]', err);
      toast.error(getErrorMessage(err, 'Failed to save loan entry'));
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
      <TopBar title="Loans" />
      <PageContainer>
        <AdjustmentEntryList
          items={items}
          emptyIcon={Landmark}
          emptyTitle="No loan entries yet"
          onEdit={(item) => void openEdit(item)}
          onDelete={setDeleteTarget}
        />
      </PageContainer>

      <FAB onClick={openAdd} label="Add loan entry" />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'Edit Loan Entry' : 'Add Loan Entry'}>
        <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
          <Field label="Type" error={errors.kind?.message}>
            <Select {...register('kind')}>
              <option value="receive">Receive loan</option>
              <option value="repay">Repay loan</option>
            </Select>
          </Field>

          <Field label="Date" error={errors.date?.message}>
            <FormDateInput name="date" control={control} />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Input {...register('description')} placeholder="e.g. Bank personal loan, NBFC term loan" />
          </Field>

          <Field label="Amount" error={errors.amount?.message}>
            <MoneyInput value={amount} onChange={(v) => setValue('amount', v)} />
          </Field>

          <Field label={kind === 'receive' ? 'Received Into' : 'Paid From'} error={errors.paidFrom?.message}>
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

          <Button type="submit" disabled={isSubmitting || amount <= 0} className="w-full">
            {editingId ? 'Save Changes' : kind === 'receive' ? 'Record Loan' : 'Record Repayment'}
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
