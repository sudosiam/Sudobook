import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerSchema, type CustomerFormData } from '@/lib/validators';
import { Button, Field, Input, Textarea } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { createCustomer, updateCustomer } from '@/lib/entities';
import type { Customer } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export function CustomerForm({
  onDone,
  customer,
}: {
  onDone: (id: string) => void;
  customer?: Customer;
}) {
  const isEdit = !!customer;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', openingBalance: 0 },
  });

  useEffect(() => {
    if (customer) {
      reset({
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        openingBalance: customer.openingBalance,
        notes: customer.notes,
      });
    }
  }, [customer, reset]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (customer) {
        await updateCustomer(customer.id, {
          name: data.name,
          phone: data.phone,
          address: data.address,
          notes: data.notes,
        });
        toast.success('Customer updated');
        onDone(customer.id);
      } else {
        const id = await createCustomer(data);
        toast.success('Customer added');
        onDone(id);
      }
    } catch (err) {
      console.error('[CustomerForm]', err);
      toast.error(getErrorMessage(err, 'Failed to save customer'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
      <Field label="Name" error={errors.name?.message}>
        <Input {...register('name')} placeholder="Customer name" />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} placeholder="Phone number" inputMode="tel" />
      </Field>
      <Field label="Address" error={errors.address?.message}>
        <Textarea {...register('address')} placeholder="Optional" />
      </Field>
      {!isEdit && (
        <Field label="Opening Balance (they owe you)" error={errors.openingBalance?.message}>
          <MoneyInput value={watch('openingBalance')} onChange={(v) => setValue('openingBalance', v)} />
        </Field>
      )}
      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register('notes')} placeholder="Optional" />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isEdit ? 'Save Changes' : 'Save Customer'}
      </Button>
    </form>
  );
}
