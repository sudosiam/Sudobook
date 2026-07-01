import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type InputHTMLAttributes,
} from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover } from '@/components/common/Popover';
import { cn } from '@/lib/utils';

const triggerBase =
  'flex min-h-[48px] w-full items-center justify-between rounded-xl border border-border-app/60 bg-surface px-3 py-2 text-left text-sm text-foreground outline-none transition-colors focus:border-brand disabled:opacity-50';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function parseDateValue(value?: string): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return parseISO(value);
  return new Date();
}

function formatDisplay(iso: string): string {
  return parseDateValue(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Inline calendar dropdown — opens under the field. */
export const DatePicker = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, value, defaultValue, onChange, onBlur, name, disabled, ...rest }, ref) => {
    const [open, setOpen] = useState(false);
    const hiddenRef = useRef<HTMLInputElement | null>(null);

    const isControlled = value !== undefined;
    const [localValue, setLocalValue] = useState(() => String(value ?? defaultValue ?? ''));

    const effectiveValue = isControlled ? String(value ?? '') : localValue;
    const selected = parseDateValue(effectiveValue || undefined);
    const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected));

    useEffect(() => {
      if (isControlled) return;
      if (defaultValue != null && !localValue) setLocalValue(String(defaultValue));
    }, [defaultValue, isControlled, localValue]);

    useEffect(() => {
      if (isControlled && value != null) setLocalValue(String(value));
    }, [isControlled, value]);

    const mergeRef = useCallback(
      (el: HTMLInputElement | null) => {
        hiddenRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      },
      [ref],
    );

    const display = effectiveValue ? formatDisplay(effectiveValue) : 'Pick a date';

    const days = useMemo(() => {
      const start = startOfMonth(viewMonth);
      const end = endOfMonth(viewMonth);
      const leading = getDay(start);
      const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
      for (const d of eachDayOfInterval({ start, end })) cells.push(d);
      return cells;
    }, [viewMonth]);

    const commit = (date: Date) => {
      const iso = format(date, 'yyyy-MM-dd');
      if (!isControlled) setLocalValue(iso);
      if (hiddenRef.current) hiddenRef.current.value = iso;
      onChange?.({ target: { name, value: iso } } as ChangeEvent<HTMLInputElement>);
      setOpen(false);
      onBlur?.({ target: { name, value: iso } } as FocusEvent<HTMLInputElement>);
    };

    const calendar = (
      <div className="p-2">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setViewMonth((m) => subMonths(m, 1));
            }}
            className="icon-btn shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-xs font-semibold text-foreground">
            {viewMonth.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
          </p>
          <button
            type="button"
            aria-label="Next month"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setViewMonth((m) => addMonths(m, 1));
            }}
            className="icon-btn shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[9px] font-medium uppercase tracking-wide text-muted">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-0.5">
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((day, i) =>
            day ? (
              <button
                key={day.toISOString()}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  commit(day);
                }}
                className={cn(
                  'flex min-h-[34px] items-center justify-center rounded-md text-xs active:bg-surface-hover',
                  effectiveValue && isSameDay(day, selected) && isSameMonth(day, viewMonth)
                    ? 'bg-brand font-semibold text-white'
                    : 'text-foreground',
                )}
              >
                {format(day, 'd')}
              </button>
            ) : (
              <span key={`pad-${i}`} />
            ),
          )}
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            commit(new Date());
          }}
          className="mt-2 w-full py-1.5 text-center text-xs font-medium text-brand-light active:opacity-70"
        >
          Today
        </button>
      </div>
    );

    return (
      <>
        <input
          type="hidden"
          ref={mergeRef}
          name={name}
          value={effectiveValue}
          disabled={disabled}
          readOnly
          {...rest}
        />
        <Popover
          open={open}
          onClose={() => setOpen(false)}
          panel={calendar}
          minPanelWidth={280}
          panelClassName="max-w-[calc(100vw-24px)]"
        >
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (disabled) return;
              setViewMonth(startOfMonth(parseDateValue(effectiveValue || undefined)));
              setOpen((v) => !v);
            }}
            className={cn(triggerBase, open && 'border-brand', className)}
          >
            <span className={cn(!effectiveValue && 'text-disabled')}>{display}</span>
            <Calendar className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          </button>
        </Popover>
      </>
    );
  },
);
DatePicker.displayName = 'DatePicker';
