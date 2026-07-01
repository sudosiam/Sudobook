import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { db, activeWhere } from '@/lib/db';
import { loanMovementSchema, type LoanMovementFormData } from '@/lib/validators';
import { recordLoanReceived, recordLoanRepayment } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function NewLoan() {
  const navigate = useNavigate();
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoanMovementFormData>({
    resolver: zodResolver(loanMovementSchema),
    defaultValues: {
      kind: 'receive',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amount: 0,
      paidFrom: 'bank',
    },
  });

  const kind = watch('kind');
  const paidFrom = watch('paidFrom');
  const amount = watch('amount');

  const onSubmit = async (data: LoanMovementFormData) => {
    try {
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
      navigate('/more');
    } catch (err) {
      console.error('[NewLoan]', err);
      toast.error(getErrorMessage(err, 'Failed to record loan'));
    }
  };

  return (
    <>
      <TopBar title="Loan" />
      <PageContainer>
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
            {kind === 'receive' ? 'Record Loan' : 'Record Repayment'}
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
