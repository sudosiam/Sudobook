import { toINR } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { DocStatus, PaymentMethod } from '@/lib/db';

/** neutral = white · partial = yellow · profit = green (profit lines only) */
export type MoneyTone = 'neutral' | 'partial' | 'profit';

interface MoneyDisplayProps {
  amount: number; // paise
  className?: string;
  /** @deprecated Use tone="profit" — green when amount ≥ 0, white when negative */
  colored?: boolean;
  tone?: MoneyTone | 'income' | 'expense';
}

function resolveColor(amount: number, tone: MoneyDisplayProps['tone'], colored?: boolean): string {
  if (tone === 'partial') return 'text-warning';
  if (tone === 'profit' || colored) return amount >= 0 ? 'text-success' : 'text-foreground';
  // neutral, income, expense — all white (legacy income/expense map here)
  return 'text-foreground';
}

/** Pick amount colour from sale/purchase doc status or payment method. */
export function moneyToneForStatus(
  status: DocStatus,
  paymentMethod?: PaymentMethod,
): MoneyTone {
  if (status === 'partial' || paymentMethod === 'partial') return 'partial';
  return 'neutral';
}

/** Hero total on a sale/purchase detail — neutral when void, otherwise status-based. */
export function docAmountTone(status: DocStatus, paymentMethod?: PaymentMethod): MoneyTone {
  if (status === 'void') return 'neutral';
  return moneyToneForStatus(status, paymentMethod);
}

/** Due/outstanding balance — yellow for partial payment docs. */
export function docDueTone(status: DocStatus, paymentMethod?: PaymentMethod): MoneyTone {
  if (status === 'partial' || paymentMethod === 'partial') return 'partial';
  return 'neutral';
}

/** Always use this to render money in JSX. Never call toINR() inline in views. */
export function MoneyDisplay({ amount, className, colored, tone = 'neutral' }: MoneyDisplayProps) {
  const color = resolveColor(amount, tone, colored);

  return (
    <span className={cn('font-numeric tabular-nums tracking-tight', color, className)}>
      {toINR(amount)}
    </span>
  );
}
