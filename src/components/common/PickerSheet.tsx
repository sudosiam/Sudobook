import { Check } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useListboxKeyboard } from '@/hooks/useListboxKeyboard';
import { cn } from '@/lib/utils';

export interface PickerOption {
  value: string;
  label: string;
}

interface PickerListProps {
  options: PickerOption[];
  value?: string;
  onSelect: (value: string) => void;
  onClose?: () => void;
  title?: string;
  compact?: boolean;
}

/** Scrollable option list for inline dropdowns. */
export function PickerList({ options, value, onSelect, onClose, title, compact }: PickerListProps) {
  const listboxId = useId();
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { activeIndex, onKeyDown } = useListboxKeyboard({
    open: true,
    itemCount: options.length,
    onSelectIndex: (index) => onSelect(options[index]?.value ?? ''),
    onClose: onClose ?? (() => undefined),
  });

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div
      id={listboxId}
      className="max-h-[min(280px,50vh)] overflow-y-auto overscroll-contain outline-none"
      role="listbox"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      ref={(el) => el?.focus()}
    >
      {title && (
        <p className="border-b border-border-app px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          {title}
        </p>
      )}
      {options.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted">No options</p>
      ) : (
        options.map((opt, index) => {
          const selected = value === opt.value;
          const active = index === activeIndex;
          return (
            <button
              key={opt.value || '__empty__'}
              ref={(el) => {
                optionRefs.current[index] = el;
              }}
              type="button"
              role="option"
              id={`${listboxId}-opt-${index}`}
              aria-selected={selected}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(opt.value);
              }}
              className={cn(
                'picker-option flex w-full items-center justify-between border-b border-border-app text-left last:border-0 active:bg-surface-hover',
                compact ? 'min-h-[48px] px-2 py-1.5 text-xs' : 'min-h-[48px] px-3 py-2 text-sm',
                selected || active
                  ? 'bg-surface-hover font-semibold text-brand-light'
                  : 'text-foreground',
              )}
            >
              <span className="min-w-0 truncate">{opt.label}</span>
              {selected && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            </button>
          );
        })
      )}
    </div>
  );
}
