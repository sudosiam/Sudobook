import type { DocStatus } from '@/lib/db';

const map: Record<DocStatus, { label: string; className: string }> = {
  completed: { label: 'Paid', className: 'bg-surface-hover text-foreground' },
  partial: { label: 'Partial', className: 'bg-warning/15 text-warning' },
  credit: { label: 'Credit', className: 'bg-surface-hover text-muted' },
  void: { label: 'Void', className: 'bg-danger/15 text-muted' },
};

export function StatusPill({ status }: { status: DocStatus }) {
  const { label, className } = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>{label}</span>
  );
}
