import { useState } from 'react';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { Tag } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button, Field, Input } from '@/components/common/Field';
import { EntityActions } from '@/components/common/EntityActions';
import { FAB } from '@/components/common/FAB';
import { db, activeWhere, type ProductCategory } from '@/lib/db';
import { createProductCategory, updateProductCategory } from '@/lib/categories';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

function CategoryEditor({
  category,
  onDone,
}: {
  category?: ProductCategory;
  onDone: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [skuPrefix, setSkuPrefix] = useState(category?.skuPrefix ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (category) {
        await updateProductCategory(category.id, { name: name.trim(), skuPrefix });
        toast.success('Category updated');
      } else {
        await createProductCategory({ name, skuPrefix });
        toast.success('Category added');
      }
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save category'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <Field label="Category Name">
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Helmets" />
      </Field>
      <Field label="SKU Prefix">
        <Input
          value={skuPrefix}
          onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
          placeholder="e.g. HLM"
          maxLength={6}
        />
      </Field>
      <Button type="button" disabled={saving || !name.trim()} onClick={() => void save()} className="w-full">
        {category ? 'Save Changes' : 'Add Category'}
      </Button>
    </div>
  );
}

export default function ProductCategories() {
  const categories = useLiveQuery(() => db.productCategories.toArray());
  const productCounts = useLiveQuery(async () => {
    const products = await activeWhere(db.products).toArray();
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return counts;
  }, []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);
  const [deactivating, setDeactivating] = useState<ProductCategory | null>(null);

  const sorted = [...(categories ?? [])].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const handleDeactivate = async () => {
    if (!deactivating) return;
    try {
      await updateProductCategory(deactivating.id, { isActive: false });
      toast.success('Category hidden');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    } finally {
      setDeactivating(null);
    }
  };

  return (
    <>
      <TopBar title="Categories" />
      <PageContainer>
        {!categories ? (
          <LoadingSpinner />
        ) : sorted.length === 0 ? (
          <EmptyState icon={Tag} title="No categories yet" />
        ) : (
          <div className="space-y-2">
            {sorted.map((c) => {
              const count = productCounts?.get(c.id) ?? 0;
              return (
                <div
                  key={c.id}
                  className={`flex min-h-[56px] items-center justify-between rounded-xl border border-border-app bg-surface px-4 py-3 ${!c.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {c.name}
                      {!c.isActive && <span className="ml-2 text-xs text-muted">(hidden)</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Prefix <span className="font-mono">{c.skuPrefix}</span> · {count} product{count === 1 ? '' : 's'}
                    </p>
                  </div>
                  {c.isActive && (
                    <EntityActions
                      onEdit={() => setEditing(c)}
                      onDelete={() => setDeactivating(c)}
                      deleteLabel="Hide category"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>

      <FAB onClick={() => setOpen(true)} label="New category" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Category">
        <CategoryEditor onDone={() => setOpen(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Category">
        {editing && <CategoryEditor category={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!deactivating}
        title="Hide this category?"
        message={`Hide ${deactivating?.name ?? 'this category'}?`}
        confirmLabel="Hide"
        danger
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivating(null)}
      />
    </>
  );
}
