import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, Field, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { AccountCategorySelect } from '@/components/common/AccountCategorySelect';
import { db, activeWhere } from '@/lib/db';
import { recurringExpenseSchema, type RecurringExpenseFormData } from '@/lib/validators';
import { CODES } from '@/lib/coa';
import { useSelectableExpenseAccounts } from '@/hooks/useAccountCategories';
import { createRecurringExpense } from '@/lib/recurring';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function NewRecurringExpense() {
  const navigate = useNavigate();
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());
  const expenseAccounts = useSelectableExpenseAccounts();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RecurringExpenseFormData>({
    resolver: zodResolver(recurringExpenseSchema),
    defaultValues: {
      name: '',
      accountCode: CODES.RENT,
      category: 'Rent',
      description: '',
      amount: 0,
      paidFrom: 'cash',
      dayOfMonth: 1,
    },
  });

  const paidFrom = watch('paidFrom');
  const accountCode = watch('accountCode');

  const onSubmit = async (data: RecurringExpenseFormData) => {
    try {
      await createRecurringExpense(data);
      toast.success('Recurring expense saved');
      navigate('/expenses');
    } catch (err) {
      console.error('[NewRecurringExpense]', err);
      toast.error(getErrorMessage(err, 'Failed to save'));
    }
  };

  return (
    <>
      <TopBar title="Recurring Expense" />
      <PageContainer>
        <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
          <Field label="Template Name" error={errors.name?.message}>
            <Input {...register('name')} placeholder="e.g. Shop Rent" />
          </Field>

          <Field label="Category" error={errors.category?.message || errors.accountCode?.message}>
            <AccountCategorySelect
              accounts={expenseAccounts}
              value={accountCode}
              onChange={(code, name) => {
                setValue('accountCode', code);
                setValue('category', name);
              }}
            />
          </Field>

          <Field label="Description" error={errors.description?.message}>
            <Input {...register('description')} placeholder="Monthly shop rent" />
          </Field>

          <Field label="Amount (each month)" error={errors.amount?.message}>
            <MoneyInput value={watch('amount')} onChange={(v) => setValue('amount', v)} />
          </Field>

          <Field label="Day of Month" error={errors.dayOfMonth?.message}>
            <Select {...register('dayOfMonth', { valueAsNumber: true })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Paid From" error={errors.paidFrom?.message}>
            <Select {...register('paidFrom')}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </Select>
          </Field>

          {paidFrom === 'bank' && (
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

          <Button
            type="submit"
            disabled={isSubmitting || !expenseAccounts?.length}
            className="w-full"
          >
            Save Template
          </Button>
        </form>
      </PageContainer>
    </>
  );
}
