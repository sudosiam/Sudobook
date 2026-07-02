import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { EntityActions } from '@/components/common/EntityActions';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import type { AdjustmentListItem } from '@/lib/adjustmentRecords';

export function AdjustmentEntryList({
  items,
  emptyIcon: Icon,
  emptyTitle,
  onEdit,
  onDelete,
}: {
  items: AdjustmentListItem[];
  emptyIcon: LucideIcon;
  emptyTitle: string;
  onEdit: (item: AdjustmentListItem) => void;
  onDelete: (item: AdjustmentListItem) => void;
}) {
  if (items.length === 0) {
    return <EmptyState icon={Icon} title={emptyTitle} />;
  }

  return (
    <div className="list-shell">
      {items.map((item) => (
        <div
          key={item.linkedId}
          className="flex min-h-[64px] items-center gap-2 border-b border-border-app px-3 py-3 last:border-0"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-0.5 text-xs text-muted">
              {item.subtitle ? `${item.subtitle} · ` : ''}
              {item.date}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <MoneyDisplay amount={item.amount} className="text-sm font-semibold" />
            <EntityActions
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              deleteLabel="Remove entry"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
