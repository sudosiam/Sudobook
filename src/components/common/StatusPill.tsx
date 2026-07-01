import { Ban, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import type { DocStatus } from '@/lib/db';

const map: Record<
  DocStatus,
  { label: string; className: string; Icon: typeof CheckCircle2 }
> = {
  completed: { label: 'Paid', className: 'bg-success/15 text-success', Icon: CheckCircle2 },
  partial: { label: 'Partial', className: 'bg-warning/15 text-warning', Icon: Clock },
  credit: { label: 'Credit', className: 'bg-surface-hover text-muted', Icon: CreditCard },
  void: { label: 'Void', className: 'bg-danger/15 text-muted', Icon: Ban },
};

/** Status pill with icon + label for colorblind-friendly scanning (BUG-35). */
export function StatusPill({ status }: { status: DocStatus }) {
  const { label, className, Icon } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}
