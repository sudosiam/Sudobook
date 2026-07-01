import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EntityActions({
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
  className,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  className?: string;
}) {
  if (!onEdit && !onDelete) return null;

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {onEdit && (
        <button type="button" onClick={onEdit} className="icon-btn" aria-label="Edit">
          <Pencil className="h-4 w-4" />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="icon-btn text-danger hover:text-danger"
          aria-label={deleteLabel}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Compact row action — icon-only void/delete. */
export function RowActionButton({
  onClick,
  label,
  disabled,
}: {
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="icon-btn shrink-0 text-danger disabled:opacity-40"
      aria-label={label}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
