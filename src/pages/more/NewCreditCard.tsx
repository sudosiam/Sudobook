import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { AccountCategorySelect } from '@/components/common/AccountCategorySelect';
import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { useSelectableExpenseAccounts } from '@/hooks/useAccountCategories';
import { db, activeWhere } from '@/lib/db';
import { creditCardSchema, type CreditCardFormData } from '@/lib/validators';
import { recordCreditCardCharge, recordCreditCardPayment } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function NewCreditCard() {
  const navigate = useNavigate();
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());
  const expenseAccounts = useSelectableExpenseAccounts();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      kind: 'payment',
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      amount: 0,
      paidFrom: 'bank',
    },
  });

  const kind = watch('kind');
  const paidFrom = watch('paidFrom');
  const amount = watch('amount');
  const accountCode = watch('accountCode');

  const onSubmit = async (data: CreditCardFormData) => {
    try {
      if (data.kind === 'payment') {
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
      navigate('/more');
    } catch (err) {
      console.error('[NewCreditCard]', err);
      toast.error(getErrorMessage(err, 'Failed to record credit card entry'));
    }
  };

  return (
    <>
      <TopBar title="Credit Card" />
      <PageContainer>
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
            {kind === 'payment' ? 'Record Payment' : 'Record Expense'}
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
