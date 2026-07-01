import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { db } from '@/lib/db';
import { fixedAssetPurchaseSchema, type FixedAssetPurchaseFormData } from '@/lib/validators';
import { recordFixedAssetPurchase } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function NewFixedAsset() {
  const navigate = useNavigate();
  const banks = useLiveQuery(() => db.bankAccounts.where('isActive').equals(1).toArray());

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FixedAssetPurchaseFormData>({
    resolver: zodResolver(fixedAssetPurchaseSchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amount: 0,
      paidFrom: 'cash',
    },
  });

  const paidFrom = watch('paidFrom');
  const amount = watch('amount');

  const onSubmit = async (data: FixedAssetPurchaseFormData) => {
    try {
      await recordFixedAssetPurchase({
        date: data.date,
        description: data.description,
        amount: data.amount,
        paidFrom: data.paidFrom,
        bankAccountId: data.bankAccountId || undefined,
      });
      toast.success('Fixed asset recorded');
      navigate('/more');
    } catch (err) {
      console.error('[NewFixedAsset]', err);
      toast.error(getErrorMessage(err, 'Failed to record fixed asset'));
    }
  };

  return (
    <>
      <TopBar title="Fixed Asset" />
      <PageContainer>
        <p className="mb-3 text-xs text-muted">
          Records a capital purchase — debits Fixed Assets (105) and credits your cash or bank account.
          Use this for showroom equipment, furniture, or fixtures, not resale inventory.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
          <Field label="Date" error={errors.date?.message}>
            <FormDateInput name="date" control={control} />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Input {...register('description')} placeholder="e.g. Battery testing bench, display rack" />
          </Field>

          <Field label="Amount" error={errors.amount?.message}>
            <MoneyInput value={watch('amount')} onChange={(v) => setValue('amount', v)} />
          </Field>

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

          <Button type="submit" disabled={isSubmitting || amount <= 0} className="w-full">
            Record Fixed Asset
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
