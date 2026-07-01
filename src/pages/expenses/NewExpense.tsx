import { useNavigate } from 'react-router-dom';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { useLiveQuery } from 'dexie-react-hooks';

import { format } from 'date-fns';

import { TopBar } from '@/components/layout/TopBar';

import { PageContainer } from '@/components/layout/PageContainer';

import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';

import { MoneyInput } from '@/components/common/MoneyInput';

import { AccountCategorySelect } from '@/components/common/AccountCategorySelect';

import { db } from '@/lib/db';

import { expenseSchema, type ExpenseFormData } from '@/lib/validators';

import { recordExpense } from '@/lib/transactions';

import { CODES } from '@/lib/coa';

import { useSelectableExpenseAccounts } from '@/hooks/useAccountCategories';

import { toast } from '@/store/useToast';



export default function NewExpense() {

  const navigate = useNavigate();

  const banks = useLiveQuery(() => db.bankAccounts.filter((b) => b.isActive).toArray());

  const expenseAccounts = useSelectableExpenseAccounts();



  const {

    register,
    control,
    handleSubmit,

    watch,

    setValue,

    formState: { errors, isSubmitting },

  } = useForm<ExpenseFormData>({

    resolver: zodResolver(expenseSchema),

    defaultValues: {

      date: format(new Date(), 'yyyy-MM-dd'),

      accountCode: CODES.RENT,

      category: 'Rent',

      description: '',

      amount: 0,

      paidFrom: 'cash',

    },

  });



  const paidFrom = watch('paidFrom');

  const amount = watch('amount');

  const accountCode = watch('accountCode');



  const onSubmit = async (data: ExpenseFormData) => {

    try {

      await recordExpense({

        date: data.date,

        accountCode: data.accountCode,

        category: data.category,

        description: data.description,

        amount: data.amount,

        paidFrom: data.paidFrom,

        bankAccountId: data.bankAccountId || undefined,

      });

      toast.success('Expense recorded');

      navigate('/expenses');

    } catch (err) {

      console.error('[NewExpense]', err);

      toast.error(err instanceof Error ? err.message : 'Failed to record expense');

    }

  };



  return (

    <>

      <TopBar title="New Expense" />

      <PageContainer>

        <form onSubmit={handleSubmit(onSubmit)} className="page-stack">

          <Field label="Date" error={errors.date?.message}>

            <FormDateInput name="date" control={control} />

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

            <Input {...register('description')} placeholder="What was this for?" />

          </Field>



          <Field label="Amount" error={errors.amount?.message}>

            <MoneyInput value={watch('amount')} onChange={(v) => setValue('amount', v)} />

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

            disabled={isSubmitting || !expenseAccounts?.length || amount <= 0}

            className="w-full"

          >

            Record Expense

          </Button>

        </form>

      </PageContainer>

    </>

  );

}

