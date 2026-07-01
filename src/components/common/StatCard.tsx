import { Link } from 'react-router-dom';
import { MoneyDisplay, type MoneyTone } from '@/components/common/MoneyDisplay';
import { cn } from '@/lib/utils';

export function StatCard({
  label,
  amount,
  tone = 'neutral',
  colored,
  className,
  animate,
  to,
  onClick,
}: {
  label: string;
  amount: number;
  tone?: MoneyTone | 'income' | 'expense';
  colored?: boolean;
  className?: string;
  animate?: boolean;
  to?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="section-label">{label}</p>
      <MoneyDisplay
        amount={amount}
        tone={tone}
        colored={colored}
        animate={animate}
        className="block text-lg font-semibold"
      />
    </>
  );

  const cardClass = cn(
    'card space-y-0.5 text-left transition-colors',
    (to || onClick) && 'active:bg-surface-hover cursor-pointer',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={cardClass}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cardClass, 'w-full')}>
        {inner}
      </button>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}
