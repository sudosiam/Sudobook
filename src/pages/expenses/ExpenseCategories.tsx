import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
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
import { db, type Account } from '@/lib/db';
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
      {readOnly ? (
        <p className="text-xs text-muted">Default categories can be used but not renamed or removed.</p>
      ) : (
        <p className="text-xs text-muted">
          Appears in expense forms and reports. Assigned the next free account code (508+).
        </p>
      )}
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
  const usageCounts = useLiveQuery(async () => {
    const expenses = await db.expenses.toArray();
    const counts = new Map<number, number>();
    for (const e of expenses) {
      if (e.voidedAt) continue;
      counts.set(e.accountCode, (counts.get(e.accountCode) ?? 0) + 1);
    }
    return counts;
  }, []);

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
        <p className="mb-3 text-xs text-muted">
          Default categories (Rent, Salaries, etc.) are built in. Add your own for anything else — they sync to the
          chart of accounts automatically.
        </p>

        {categories.length === 0 ? (
          <EmptyState icon={Tag} title="No categories" description="Add your first expense category." />
        ) : (
          <div className="list-shell">
            {categories.map((c) => {
              const count = usageCounts?.get(c.code) ?? 0;
              const isDefault = isDefaultExpenseAccount(c.code);
              return (
                <div
                  key={c.id}
                  className="flex min-h-[52px] items-center justify-between gap-2 border-b border-border-app px-3 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted">
                      Acct {c.code}
                      {isDefault ? ' · default' : ' · custom'}
                      {count > 0 ? ` · ${count} expense${count === 1 ? '' : 's'}` : ''}
                    </p>
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
        message={
          removeTarget && (usageCounts?.get(removeTarget.code) ?? 0) > 0
            ? `${removeTarget.name} has existing expenses — it will be hidden from new entries but past records stay intact.`
            : `${removeTarget?.name ?? 'This category'} will be hidden from expense forms.`
        }
        confirmLabel="Remove"
        danger
        onConfirm={confirmRemove}
        onCancel={() => setRemoveId(null)}
      />
    </>
  );
}
