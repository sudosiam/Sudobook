import { useEffect, useState } from 'react';
import { paiseToRupees, toPaise } from '@/lib/money';
import { cn } from '@/lib/utils';

interface MoneyInputProps {
  value: number; // paise
  onChange: (paise: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

/** ₹ input. Displays rupees, emits integer paise on change. */
export function MoneyInput({
  value,
  onChange,
  placeholder = '0.00',
  className,
  id,
  disabled,
}: MoneyInputProps) {
  const [text, setText] = useState(value ? String(paiseToRupees(value)) : '');

  useEffect(() => {
    // Keep in sync when the paise value changes externally (e.g. auto-fill paid amount).
    const normalized = value ? String(paiseToRupees(value)) : '';
    if (toPaise(text || '0') !== value || text !== normalized) {
      setText(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cn('relative', className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted">
        ₹
      </span>
      <input
        id={id}
        inputMode="decimal"
        disabled={disabled}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.]/g, '');
          setText(raw);
          onChange(toPaise(raw || '0'));
        }}
        className="min-h-[48px] w-full rounded-xl border border-border-app/60 bg-surface py-2 pl-8 pr-3 text-right font-numeric text-sm tabular-nums tracking-tight text-foreground outline-none transition-colors placeholder:text-disabled focus:border-brand disabled:opacity-50"
      />
    </div>
  );
}
