import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Sparkles } from 'lucide-react';
import { productSchema, type ProductFormData } from '@/lib/validators';
import { Button, Field, Input, QtyInput, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { createProduct, updateProduct } from '@/lib/entities';
import { createProductCategory, previewNextSku } from '@/lib/categories';
import { db, activeWhere, type Product } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export function ProductForm({
  onDone,
  product,
}: {
  onDone: (id: string) => void;
  product?: Product;
}) {
  const isEdit = !!product;
  const categories = useLiveQuery(() => activeWhere(db.productCategories).toArray(), []);

  const [addingCategory, setAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatPrefix, setNewCatPrefix] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [skuAuto, setSkuAuto] = useState(!isEdit);

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
      category: '',
      unit: 'pcs',
      costPrice: 0,
      sellingPrice: 0,
      stockQty: 0,
      minStock: 0,
    },
  });

  const categoryId = watch('category');

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
      setSkuAuto(false);
    }
  }, [product, reset]);

  // Default to the first available category once loaded (new product only).
  useEffect(() => {
    if (!isEdit && !categoryId && categories && categories.length > 0) {
      setValue('category', categories[0].id);
    }
  }, [isEdit, categoryId, categories, setValue]);

  // Live SKU suggestion while the user hasn't typed a custom one.
  useEffect(() => {
    if (isEdit || !skuAuto || !categoryId) return;
    let cancelled = false;
    void previewNextSku(categoryId).then((sku) => {
      if (!cancelled) setValue('sku', sku);
    });
    return () => {
      cancelled = true;
    };
  }, [isEdit, skuAuto, categoryId, setValue]);

  const saveNewCategory = async () => {
    if (!newCatName.trim()) return;
    setSavingCategory(true);
    try {
      const id = await createProductCategory({ name: newCatName, skuPrefix: newCatPrefix });
      setValue('category', id);
      setSkuAuto(true);
      setNewCatName('');
      setNewCatPrefix('');
      setAddingCategory(false);
      toast.success('Category added');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to add category'));
    } finally {
      setSavingCategory(false);
    }
  };

  const costPrice = watch('costPrice');
  const sellingPrice = watch('sellingPrice');
  const minStock = watch('minStock');
  const marginPct =
    sellingPrice > 0 ? Math.round(((sellingPrice - costPrice) / sellingPrice) * 100) : null;

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
      toast.error(getErrorMessage(err, 'Failed to save product'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
      <div className="grid grid-cols-2 gap-2">
        <Field label="SKU" error={errors.sku?.message}>
          <Input
            {...register('sku', { onChange: () => setSkuAuto(false) })}
            placeholder="Auto-generated"
          />
        </Field>
        <Field label="Unit" error={errors.unit?.message}>
          <Input {...register('unit')} placeholder="pcs" />
        </Field>
      </div>
      {!isEdit && (
        <p className="-mt-1 flex items-center gap-1 text-xs text-muted">
          {skuAuto ? (
            <>
              <Sparkles className="h-3 w-3 text-brand-light" /> Auto-generated from category — edit to set your own
            </>
          ) : (
            'Custom SKU'
          )}
        </p>
      )}

      <Field label="Name" error={errors.name?.message}>
        <Input {...register('name')} placeholder="Product name" />
      </Field>

      <Field label="Category" error={errors.category?.message}>
        <div className="flex min-w-0 gap-2">
          <Select
            {...register('category', { onChange: () => setSkuAuto(!isEdit) })}
            className="min-w-0 flex-1"
            pickerTitle="Category"
          >
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={() => setAddingCategory((v) => !v)}
            className="icon-btn h-[48px] w-[48px] shrink-0"
            aria-label="Add category"
            aria-expanded={addingCategory}
          >
            <Plus className={`h-4 w-4 transition-transform ${addingCategory ? 'rotate-45' : ''}`} />
          </button>
        </div>
      </Field>

      {addingCategory && (
        <div className="card space-y-3 border-brand/30">
          <div className="grid grid-cols-2 gap-2">
            <Field label="New Category Name">
              <Input
                autoFocus
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Helmets"
              />
            </Field>
            <Field label="SKU Prefix">
              <Input
                value={newCatPrefix}
                onChange={(e) => setNewCatPrefix(e.target.value.toUpperCase())}
                placeholder="e.g. HLM"
                maxLength={6}
              />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setAddingCategory(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={savingCategory || !newCatName.trim()}
              onClick={() => void saveNewCategory()}
            >
              Add Category
            </Button>
          </div>
        </div>
      )}

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

      {marginPct !== null && sellingPrice > 0 && (
        <p className="text-xs text-muted">
          Margin:{' '}
          <span className={marginPct >= 0 ? 'text-success' : 'text-danger'}>{marginPct}%</span>
          {costPrice > 0 && sellingPrice > costPrice && (
            <span className="text-muted">
              {' '}
              · markup {Math.round(((sellingPrice - costPrice) / costPrice) * 100)}%
            </span>
          )}
        </p>
      )}

      {!isEdit ? (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Opening Stock" error={errors.stockQty?.message}>
            <QtyInput {...register('stockQty', { valueAsNumber: true })} />
          </Field>
          <Field label="Min Stock Alert" error={errors.minStock?.message}>
            <QtyInput {...register('minStock', { valueAsNumber: true })} />
          </Field>
        </div>
      ) : (
        <Field label="Min Stock Alert" error={errors.minStock?.message}>
          <QtyInput {...register('minStock', { valueAsNumber: true })} />
          {isEdit && product && (
            <p
              className={`mt-1 text-xs ${
                product.stockQty <= minStock ? 'text-warning' : 'text-success'
              }`}
            >
              Current stock: {product.stockQty} {product.unit}
              {product.stockQty <= minStock ? ' — below minimum' : ' — OK'}
            </p>
          )}
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
