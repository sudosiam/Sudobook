import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Modal } from '@/components/common/Modal';
import { Button, Field, FormDateInput, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import type { BankAccount } from '@/lib/db';
import { paymentAgainstDueSchema, type PaymentFormData } from '@/lib/validators';

interface PaymentModalProps {
  open: boolean;
  title: string;
  maxDue: number; // paise
  banks: BankAccount[];
  onClose: () => void;
  onSubmit: (data: PaymentFormData) => Promise<void>;
  submitLabel?: string;
}

export function PaymentModal({
  open,
  title,
  maxDue,
  banks,
  onClose,
  onSubmit,
  submitLabel = 'Confirm Payment',
}: PaymentModalProps) {
  const schema = paymentAgainstDueSchema(maxDue);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      amount: maxDue,
      method: 'cash',
      bankAccountId: '',
    },
  });

  const method = watch('method');
  const needsBank = method === 'bank' || method === 'upi';

  useEffect(() => {
    if (open) {
      reset({
        date: format(new Date(), 'yyyy-MM-dd'),
        amount: maxDue,
        method: 'cash',
        bankAccountId: '',
      });
    }
  }, [open, maxDue, reset]);

  const submit = handleSubmit(async (data) => {
    await onSubmit(data);
    onClose();
  });

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <p className="text-xs text-muted">
          Outstanding: <MoneyDisplay amount={maxDue} className="text-xs font-semibold" />
        </p>

        <Field label="Date" error={errors.date?.message}>
          <FormDateInput name="date" control={control} />
        </Field>

        <Field label="Amount" error={errors.amount?.message}>
          <MoneyInput
            value={watch('amount')}
            onChange={(v) => setValue('amount', v, { shouldValidate: true })}
          />
        </Field>

        <Field label="Method" error={errors.method?.message}>
          <Select {...register('method')}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="upi">UPI</option>
          </Select>
        </Field>

        {needsBank && (
          <Field label="Bank account" error={errors.bankAccountId?.message}>
            <Select {...register('bankAccountId')}>
              <option value="">Select account</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting || maxDue <= 0}>
          {isSubmitting ? 'Processing…' : submitLabel}
        </Button>
      </form>
    </Modal>
  );
}
