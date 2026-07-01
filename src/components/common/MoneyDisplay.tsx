import { toINR } from '@/lib/money';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import type { DocStatus, PaymentMethod } from '@/lib/db';

/** neutral = white · partial = yellow · profit = green (profit lines only) */
export type MoneyTone = 'neutral' | 'partial' | 'profit';

interface MoneyDisplayProps {
  amount: number; // paise
  className?: string;
  /** @deprecated Use tone="profit" — green when amount ≥ 0, white when negative */
  colored?: boolean;
  tone?: MoneyTone | 'income' | 'expense';
  /** Animate the digits counting up/down when the amount changes — use sparingly (hero figures only). */
  animate?: boolean;
}

interface MoneyTextProps {
  amount: number; // paise
  className?: string;
  colored?: boolean;
  tone?: MoneyTone | 'income' | 'expense';
}

function resolveColor(amount: number, tone: MoneyDisplayProps['tone'], colored?: boolean): string {
  if (tone === 'partial') return 'text-warning';
  if (tone === 'profit' || colored) {
    if (amount > 0) return 'text-success';
    if (amount < 0) return 'text-danger';
    return 'text-foreground';
  }
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

function MoneyText({ amount, className, colored, tone = 'neutral' }: MoneyTextProps) {
  const color = resolveColor(amount, tone, colored);
  return (
    <span className={cn('font-numeric tabular-nums tracking-tight', color, className)}>
      {toINR(amount)}
    </span>
  );
}

/** Always use this to render money in JSX. Never call toINR() inline in views. */
export function MoneyDisplay({ amount, className, colored, tone = 'neutral', animate }: MoneyDisplayProps) {
  if (animate) {
    return <AnimatedMoneyDisplay amount={amount} className={className} colored={colored} tone={tone} />;
  }
  return <MoneyText amount={amount} className={className} colored={colored} tone={tone} />;
}

/** Money figure that counts up/down when `amount` changes — use for hero/dashboard figures only. */
function AnimatedMoneyDisplay({ amount, className, colored, tone }: MoneyTextProps) {
  const displayed = useCountUp(amount);
  return <MoneyText amount={displayed} className={className} colored={colored} tone={tone} />;
}
