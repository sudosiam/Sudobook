import { useEffect } from 'react';

import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';

import { productSchema, type ProductFormData } from '@/lib/validators';

import { Button, Field, Input, Select } from '@/components/common/Field';

import { MoneyInput } from '@/components/common/MoneyInput';

import { createProduct, updateProduct } from '@/lib/entities';

import type { Product } from '@/lib/db';

import { toast } from '@/store/useToast';



const CATEGORIES: { value: ProductFormData['category']; label: string }[] = [

  { value: 'escooter', label: 'E-Scooter' },

  { value: 'erickshaw', label: 'E-Rickshaw' },

  { value: 'battery', label: 'Battery' },

  { value: 'part', label: 'Part' },

  { value: 'other', label: 'Other' },

];



export function ProductForm({

  onDone,

  product,

}: {

  onDone: (id: string) => void;

  product?: Product;

}) {

  const isEdit = !!product;



  const {

    register,

    handleSubmit,

    setValue,

    watch,

    reset,

    formState: { errors, isSubmitting },

  } = useForm<ProductFormData>({

    resolver: zodResolver(productSchema),

    defaultValues: {

      sku: '',

      name: '',

      category: 'escooter',

      unit: 'pcs',

      costPrice: 0,

      sellingPrice: 0,

      stockQty: 0,

      minStock: 0,

    },

  });



  useEffect(() => {

    if (product) {

      reset({

        sku: product.sku,

        name: product.name,

        category: product.category,

        unit: product.unit,

        costPrice: product.costPrice,

        sellingPrice: product.sellingPrice,

        stockQty: product.stockQty,

        minStock: product.minStock,

      });

    }

  }, [product, reset]);



  const onSubmit = async (data: ProductFormData) => {

    try {

      if (product) {

        await updateProduct(product.id, {
          sku: data.sku,
          name: data.name,
          category: data.category,
          unit: data.unit,
          sellingPrice: data.sellingPrice,
          minStock: data.minStock,
        });

        toast.success('Product updated');

        onDone(product.id);

      } else {

        const id = await createProduct(data);

        toast.success('Product added');

        onDone(id);

      }

    } catch (err) {

      console.error('[ProductForm]', err);

      toast.error(err instanceof Error ? err.message : 'Failed to save product');

    }

  };



  return (

    <form onSubmit={handleSubmit(onSubmit)} className="page-stack">

      <div className="grid grid-cols-2 gap-2">

        <Field label="SKU" error={errors.sku?.message}>

          <Input {...register('sku')} placeholder="ESC-60V" />

        </Field>

        <Field label="Unit" error={errors.unit?.message}>

          <Input {...register('unit')} placeholder="pcs" />

        </Field>

      </div>

      <Field label="Name" error={errors.name?.message}>

        <Input {...register('name')} placeholder="Product name" />

      </Field>

      <Field label="Category" error={errors.category?.message}>

        <Select {...register('category')}>

          {CATEGORIES.map((c) => (

            <option key={c.value} value={c.value}>

              {c.label}

            </option>

          ))}

        </Select>

      </Field>

      {!isEdit ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cost Price" error={errors.costPrice?.message}>
            <MoneyInput value={watch('costPrice')} onChange={(v) => setValue('costPrice', v)} />
          </Field>
          <Field label="Selling Price" error={errors.sellingPrice?.message}>
            <MoneyInput value={watch('sellingPrice')} onChange={(v) => setValue('sellingPrice', v)} />
          </Field>
        </div>
      ) : (
        <Field label="Selling Price" error={errors.sellingPrice?.message}>
          <MoneyInput value={watch('sellingPrice')} onChange={(v) => setValue('sellingPrice', v)} />
        </Field>
      )}

      {!isEdit ? (

        <div className="grid grid-cols-2 gap-2">

          <Field label="Opening Stock" error={errors.stockQty?.message}>

            <Input type="number" {...register('stockQty', { valueAsNumber: true })} />

          </Field>

          <Field label="Min Stock Alert" error={errors.minStock?.message}>

            <Input type="number" {...register('minStock', { valueAsNumber: true })} />

          </Field>

        </div>

      ) : (

        <Field label="Min Stock Alert" error={errors.minStock?.message}>

          <Input type="number" {...register('minStock', { valueAsNumber: true })} />

        </Field>

      )}

      {isEdit && (
        <p className="text-xs text-muted">
          Cost price updates via purchases only. Use Adjust Stock to change quantity.
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full">

        {isEdit ? 'Save Changes' : 'Save Product'}

      </Button>

    </form>

  );

}


