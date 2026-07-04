import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { type Account } from '@/lib/db';
import {
  createExpenseCategory,
  isDefaultExpenseAccount,
  listExpenseCategoryAccounts,
  updateExpenseCategory,
} from '@/lib/expenseCategories';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

function CategoryEditor({ category, onDone }: { category?: Account; onDone: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [saving, setSaving] = useState(false);
  const readOnly = category ? isDefaultExpenseAccount(category.code) : false;

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (category) {
        await updateExpenseCategory(category.id, { name: name.trim() });
        toast.success('Category updated');
      } else {
        await createExpenseCategory(name);
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
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Transport, Insurance, Repairs"
          disabled={readOnly}
        />
      </Field>
      {!readOnly && (
        <Button type="button" disabled={saving || !name.trim()} onClick={() => void save()} className="w-full">
          {category ? 'Save Changes' : 'Add Category'}
        </Button>
      )}
    </div>
  );
}

export default function ExpenseCategories() {
  const categories = useLiveQuery(() => listExpenseCategoryAccounts(), []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);

  const removeTarget = categories?.find((c) => c.id === removeId);

  const confirmRemove = async () => {
    if (!removeId) return;
    try {
      await updateExpenseCategory(removeId, { isActive: false });
      toast.success('Category removed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to remove category'));
    } finally {
      setRemoveId(null);
    }
  };

  if (categories === undefined) return <LoadingSpinner />;

  return (
    <>
      <TopBar title="Expense Categories" />
      <PageContainer>
        {categories.length === 0 ? (
          <EmptyState icon={Tag} title="No categories" />
        ) : (
          <div className="list-shell">
            {categories.map((c) => {
              const isDefault = isDefaultExpenseAccount(c.code);
              return (
                <div
                  key={c.id}
                  className="flex min-h-[52px] items-center justify-between gap-2 border-b border-border-app px-3 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted font-mono tabular-nums">{c.code}</p>
                  </div>
                  {!isDefault && (
                    <EntityActions
                      onEdit={() => setEditing(c)}
                      onDelete={() => setRemoveId(c.id)}
                      deleteLabel="Remove category"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Link
          to="/expenses"
          className="mt-4 block text-center text-sm text-brand-light active:opacity-80"
        >
          Back to expenses
        </Link>
      </PageContainer>

      <FAB onClick={() => setOpen(true)} label="Add category" />

      <Modal open={open} onClose={() => setOpen(false)} title="New Expense Category">
        <CategoryEditor onDone={() => setOpen(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Category">
        {editing && <CategoryEditor category={editing} onDone={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={removeId !== null}
        title="Remove this category?"
        message={`Remove ${removeTarget?.name ?? 'this category'}?`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setRemoveId(null)}
      />
    </>
  );
}
