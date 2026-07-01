import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover } from '@/components/common/Popover';
import { PickerList, type PickerOption } from '@/components/common/PickerSheet';
import { cn } from '@/lib/utils';

const triggerBase =
  'w-full rounded-xl border border-border-app/60 bg-surface text-foreground outline-none transition-colors focus:border-brand disabled:opacity-50';

function extractOptions(children: ReactNode): PickerOption[] {
  const opts: PickerOption[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode };
    if (child.type !== 'option' && props.value === undefined) return;
    opts.push({
      value: String(props.value ?? ''),
      label: String(props.children ?? ''),
    });
  });
  return opts;
}

export interface NativeSelectProps {
  className?: string;
  children?: ReactNode;
  name?: string;
  value?: string | number | readonly string[];
  defaultValue?: string | number | readonly string[];
  onChange?: SelectHTMLAttributes<HTMLSelectElement>['onChange'];
  onBlur?: SelectHTMLAttributes<HTMLSelectElement>['onBlur'];
  disabled?: boolean;
  required?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  pickerTitle?: string;
  size?: 'default' | 'compact';
}

/** Inline dropdown select — opens under the field, one tap to pick. */
export const NativeSelect = forwardRef<HTMLInputElement, NativeSelectProps>(
  (
    {
      className,
      children,
      value,
      defaultValue,
      onChange,
      onBlur,
      name,
      disabled,
      pickerTitle,
      size = 'default',
      required,
      id,
      'aria-label': ariaLabel,
      'aria-invalid': ariaInvalid,
      'aria-describedby': ariaDescribedby,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const hiddenRef = useRef<HTMLInputElement | null>(null);
    const options = useMemo(() => extractOptions(children), [children]);

    const isControlled = value !== undefined && value !== null;
    const [localValue, setLocalValue] = useState(() => String(value ?? defaultValue ?? ''));

    useEffect(() => {
      if (isControlled) return;
      if (defaultValue != null && !localValue) setLocalValue(String(defaultValue));
    }, [defaultValue, isControlled, localValue]);

    useEffect(() => {
      if (isControlled) setLocalValue(String(value));
    }, [isControlled, value]);

    const effectiveValue = isControlled ? String(value ?? '') : localValue;
    const selected = options.find((o) => o.value === effectiveValue);
    const placeholder = options.find((o) => o.value === '');
    const display = selected?.label ?? placeholder?.label ?? 'Select…';

    const mergeRef = useCallback(
      (el: HTMLInputElement | null) => {
        hiddenRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      },
      [ref],
    );

    const pick = (next: string) => {
      if (!isControlled) setLocalValue(next);
      if (hiddenRef.current) hiddenRef.current.value = next;
      onChange?.({ target: { name, value: next } } as ChangeEvent<HTMLSelectElement>);
      setOpen(false);
      onBlur?.({ target: { name, value: next } } as FocusEvent<HTMLSelectElement>);
    };

    const close = () => {
      setOpen(false);
      onBlur?.({ target: { name, value: effectiveValue } } as FocusEvent<HTMLSelectElement>);
    };

    return (
      <>
        <input
          type="hidden"
          ref={mergeRef}
          name={name}
          value={effectiveValue}
          disabled={disabled}
          required={required}
          readOnly
        />
        <Popover
          open={open}
          onClose={close}
          panel={
            <PickerList
              options={options}
              value={effectiveValue}
              onSelect={pick}
              onClose={close}
              title={pickerTitle}
              compact={size === 'compact'}
            />
          }
        >
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedby}
            aria-haspopup="listbox"
            aria-expanded={open}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (!open) setOpen(true);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setOpen((v) => !v);
            }}
            className={cn(
              triggerBase,
              'flex items-center justify-between gap-2 text-left',
              size === 'compact' ? 'min-h-[48px] px-2 py-1 text-xs' : 'min-h-[48px] px-3 py-2 text-sm',
              open && 'border-brand',
              className,
            )}
          >
            <span className={cn('min-w-0 truncate', !selected && effectiveValue === '' && 'text-disabled')}>
              {display}
            </span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
              aria-hidden
            />
          </button>
        </Popover>
      </>
    );
  },
);
NativeSelect.displayName = 'NativeSelect';
