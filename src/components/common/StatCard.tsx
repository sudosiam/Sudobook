import type { ReactNode } from 'react';
import { MoneyDisplay, type MoneyTone } from '@/components/common/MoneyDisplay';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  amount,
  tone = 'neutral',
  colored,
  hint,
  className,
  animate,
}: {
  label: string;
  amount: number;
  tone?: MoneyTone | 'income' | 'expense';
  colored?: boolean;
  hint?: ReactNode;
  className?: string;
  /** Animate the amount counting up/down on change — use sparingly (dashboard only). */
  animate?: boolean;
}) {
  return (
    <div className={cn('card space-y-0.5', className)}>
      <p className="section-label">{label}</p>
      <MoneyDisplay
        amount={amount}
        tone={tone}
        colored={colored}
        animate={animate}
        className="block text-lg font-semibold"
      />
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );
}
