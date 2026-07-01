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
import { ownerCapitalSchema, type OwnerCapitalFormData } from '@/lib/validators';
import { recordOwnerContribution, recordOwnerDraw } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function NewOwnerCapital() {
  const navigate = useNavigate();
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OwnerCapitalFormData>({
    resolver: zodResolver(ownerCapitalSchema),
    defaultValues: {
      kind: 'contribution',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amount: 0,
      paidFrom: 'bank',
    },
  });

  const kind = watch('kind');
  const paidFrom = watch('paidFrom');
  const amount = watch('amount');

  const onSubmit = async (data: OwnerCapitalFormData) => {
    try {
      const payload = {
        date: data.date,
        description: data.description,
        amount: data.amount,
        paidFrom: data.paidFrom,
        bankAccountId: data.bankAccountId || undefined,
      };
      if (data.kind === 'contribution') await recordOwnerContribution(payload);
      else await recordOwnerDraw(payload);
      toast.success(data.kind === 'contribution' ? 'Contribution recorded' : 'Owner draw recorded');
      navigate('/more');
    } catch (err) {
      console.error('[NewOwnerCapital]', err);
      toast.error(getErrorMessage(err, 'Failed to record owner capital entry'));
    }
  };

  return (
    <>
      <TopBar title="Owner's Capital" />
      <PageContainer>
        <p className="mb-3 text-xs text-muted">
          {kind === 'contribution'
            ? 'Owner puts money in — debits cash/bank and credits Owner\'s Capital (301).'
            : 'Owner takes money out — debits Owner\'s Capital (301) and credits cash/bank.'}
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
          <Field label="Type" error={errors.kind?.message}>
            <Select {...register('kind')}>
              <option value="contribution">Owner contribution</option>
              <option value="draw">Owner draw</option>
            </Select>
          </Field>

          <Field label="Date" error={errors.date?.message}>
            <FormDateInput name="date" control={control} />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Input {...register('description')} placeholder="e.g. Personal funds invested, owner withdrawal" />
          </Field>

          <Field label="Amount" error={errors.amount?.message}>
            <MoneyInput value={amount} onChange={(v) => setValue('amount', v)} />
          </Field>

          <Field label={kind === 'contribution' ? 'Deposited To' : 'Paid From'} error={errors.paidFrom?.message}>
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
            {kind === 'contribution' ? 'Record Contribution' : 'Record Draw'}
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
