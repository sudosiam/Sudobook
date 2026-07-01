import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bankAccountSchema, type BankAccountFormData } from '@/lib/validators';
import { Button, Field, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { createBankAccount, updateBankAccount } from '@/lib/entities';
import { CASH_DRAWER_ID } from '@/lib/coa';
import type { BankAccount } from '@/lib/db';
import { toast } from '@/store/useToast';

export function BankAccountForm({
  onDone,
  bank,
}: {
  onDone: (id: string) => void;
  bank?: BankAccount;
}) {
  const isEdit = !!bank;
  const isCashDrawer = bank?.id === CASH_DRAWER_ID;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BankAccountFormData>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { name: '', bankName: '', accountNumber: '', accountType: 'current', openingBalance: 0 },
  });

  useEffect(() => {
    if (bank) {
      reset({
        name: bank.name,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        accountType: bank.accountType,
        openingBalance: bank.openingBalance,
      });
    }
  }, [bank, reset]);

  const onSubmit = async (data: BankAccountFormData) => {
    try {
      if (bank) {
        await updateBankAccount(bank.id, {
          name: data.name,
          bankName: data.bankName,
          accountNumber: data.accountNumber,
        });
        toast.success('Account updated');
        onDone(bank.id);
      } else {
        const id = await createBankAccount(data);
        toast.success('Bank account added');
        onDone(id);
      }
    } catch (err) {
      console.error('[BankAccountForm]', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save account');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
      <Field label="Account Name" error={errors.name?.message}>
        <Input {...register('name')} placeholder="HDFC Current A/C" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Bank Name" error={errors.bankName?.message}>
          <Input {...register('bankName')} placeholder="HDFC Bank" />
        </Field>
        <Field label="Account No." error={errors.accountNumber?.message}>
          <Input {...register('accountNumber')} placeholder="••1234" />
        </Field>
      </div>
      {!isEdit && (
        <Field label="Type" error={errors.accountType?.message}>
          <Select {...register('accountType')}>
            <option value="current">Current</option>
            <option value="savings">Savings</option>
            <option value="cash">Cash</option>
          </Select>
        </Field>
      )}
      {isEdit && isCashDrawer && (
        <p className="text-xs text-muted">This is the built-in cash drawer account.</p>
      )}
      {!isEdit && (
        <Field label="Opening Balance" error={errors.openingBalance?.message}>
          <MoneyInput value={watch('openingBalance')} onChange={(v) => setValue('openingBalance', v)} />
        </Field>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isEdit ? 'Save Changes' : 'Save Account'}
      </Button>
    </form>
  );
}
