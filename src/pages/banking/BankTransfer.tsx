import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { db } from '@/lib/db';
import { transferSchema, type TransferFormData } from '@/lib/validators';
import { transferBetweenBanks } from '@/lib/transactions';
import { toast } from '@/store/useToast';

export function BankTransferForm({ onDone }: { onDone: () => void }) {
  const banks = useLiveQuery(() => db.bankAccounts.filter((b) => b.isActive).toArray());

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd'), fromBankId: '', toBankId: '', amount: 0 },
  });

  const onSubmit = async (data: TransferFormData) => {
    try {
      await transferBetweenBanks(data);
      toast.success('Transfer complete');
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
      <Field label="Date" error={errors.date?.message}>
        <FormDateInput name="date" control={control} />
      </Field>
      <Field label="From" error={errors.fromBankId?.message}>
        <Select {...register('fromBankId')}>
          <option value="">Select source</option>
          {(banks ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="To" error={errors.toBankId?.message}>
        <Select {...register('toBankId')}>
          <option value="">Select destination</option>
          {(banks ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Amount" error={errors.amount?.message}>
        <MoneyInput value={watch('amount')} onChange={(v) => setValue('amount', v)} />
      </Field>
      <Field label="Note" error={errors.note?.message}>
        <Input {...register('note')} placeholder="Optional" />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        Transfer
      </Button>
    </form>
  );
}
