import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { vendorSchema, type VendorFormData } from '@/lib/validators';
import { Button, Field, Input, Textarea } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { createVendor, updateVendor } from '@/lib/entities';
import type { Vendor } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export function VendorForm({
  onDone,
  vendor,
}: {
  onDone: (id: string) => void;
  vendor?: Vendor;
}) {
  const isEdit = !!vendor;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: { name: '', phone: '', openingBalance: 0 },
  });

  useEffect(() => {
    if (vendor) {
      reset({
        name: vendor.name,
        phone: vendor.phone,
        company: vendor.company,
        address: vendor.address,
        openingBalance: vendor.openingBalance,
        notes: vendor.notes,
      });
    }
  }, [vendor, reset]);

  const onSubmit = async (data: VendorFormData) => {
    try {
      if (vendor) {
        await updateVendor(vendor.id, {
          name: data.name,
          phone: data.phone,
          company: data.company,
          address: data.address,
          notes: data.notes,
        });
        toast.success('Vendor updated');
        onDone(vendor.id);
      } else {
        const id = await createVendor(data);
        toast.success('Vendor added');
        onDone(id);
      }
    } catch (err) {
      console.error('[VendorForm]', err);
      toast.error(getErrorMessage(err, 'Failed to save vendor'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
      <Field label="Name" error={errors.name?.message}>
        <Input {...register('name')} placeholder="Vendor name" />
      </Field>
      <Field label="Company" error={errors.company?.message}>
        <Input {...register('company')} placeholder="Optional" />
      </Field>
      <Field label="Phone" error={errors.phone?.message}>
        <Input {...register('phone')} placeholder="Phone number" inputMode="tel" />
      </Field>
      <Field label="Address" error={errors.address?.message}>
        <Textarea {...register('address')} placeholder="Optional" />
      </Field>
      {!isEdit && (
        <Field label="Opening Balance" error={errors.openingBalance?.message}>
          <MoneyInput value={watch('openingBalance')} onChange={(v) => setValue('openingBalance', v)} />
        </Field>
      )}
      <Field label="Notes" error={errors.notes?.message}>
        <Textarea {...register('notes')} placeholder="Optional" />
      </Field>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isEdit ? 'Save Changes' : 'Save Vendor'}
      </Button>
    </form>
  );
}
