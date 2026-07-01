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
  isToday,
  parseISO,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Popover } from '@/components/common/Popover';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import { haptics } from '@/lib/haptics';

const triggerBase =
  'flex min-h-[48px] w-full items-center justify-between rounded-xl border border-border-app/60 bg-surface px-3 py-2 text-left text-sm text-foreground outline-none transition-colors focus:border-brand disabled:opacity-50';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

const gridVariants = {
  enter: (direction: number) => ({ x: direction * 24, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -24, opacity: 0 }),
};

/** Inline calendar dropdown — opens under the field. */
export const DatePicker = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className, value, defaultValue, onChange, onBlur, name, disabled, ...rest }, ref) => {
    const [open, setOpen] = useState(false);
    const hiddenRef = useRef<HTMLInputElement | null>(null);
    const [direction, setDirection] = useState(1);

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

    const changeMonth = (delta: number) => {
      haptics.tap();
      setDirection(delta);
      setViewMonth((m) => (delta > 0 ? addMonths(m, 1) : subMonths(m, 1)));
    };

    const days = useMemo(() => {
      const start = startOfMonth(viewMonth);
      const end = endOfMonth(viewMonth);
      const leading = getDay(start);
      const cells: (Date | null)[] = Array.from({ length: leading }, () => null);
      for (const d of eachDayOfInterval({ start, end })) cells.push(d);
      return cells;
    }, [viewMonth]);

    const commit = (date: Date) => {
      haptics.tap();
      const iso = format(date, 'yyyy-MM-dd');
      if (!isControlled) setLocalValue(iso);
      if (hiddenRef.current) hiddenRef.current.value = iso;
      onChange?.({ target: { name, value: iso } } as ChangeEvent<HTMLInputElement>);
      setOpen(false);
      onBlur?.({ target: { name, value: iso } } as FocusEvent<HTMLInputElement>);
    };

    const monthLabel = viewMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    const calendar = (
      <div className="w-[19rem] max-w-full p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              changeMonth(-1);
            }}
            className="icon-btn h-9 w-9 min-h-0 min-w-0 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.p
              key={monthLabel}
              initial={{ x: direction * 14, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -14, opacity: 0 }}
              transition={{ duration: 0.14 }}
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              {monthLabel}
            </motion.p>
          </AnimatePresence>
          <button
            type="button"
            aria-label="Next month"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              changeMonth(1);
            }}
            className="icon-btn h-9 w-9 min-h-0 min-w-0 shrink-0"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-1.5 grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wider text-disabled">
          {WEEKDAYS.map((d, i) => (
            <span key={`${d}-${i}`} className="py-1">
              {d}
            </span>
          ))}
        </div>

        <div className="relative overflow-hidden">
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            <motion.div
              key={monthLabel}
              custom={direction}
              variants={gridVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={springSoft}
              className="grid grid-cols-7 gap-y-1"
            >
              {days.map((day, i) =>
                day ? (
                  <div key={day.toISOString()} className="flex items-center justify-center py-0.5">
                    <motion.button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        commit(day);
                      }}
                      whileTap={{ scale: 0.88 }}
                      className={cn(
                        'relative flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-colors',
                        effectiveValue && isSameDay(day, selected) && isSameMonth(day, viewMonth)
                          ? 'bg-brand font-semibold text-white shadow-[var(--shadow-glow-brand)]'
                          : isToday(day)
                            ? 'font-semibold text-brand-light ring-1 ring-inset ring-brand/50'
                            : 'text-foreground hover:bg-surface-hover active:bg-surface-hover',
                      )}
                    >
                      {format(day, 'd')}
                    </motion.button>
                  </div>
                ) : (
                  <span key={`pad-${i}`} />
                ),
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            commit(new Date());
          }}
          className="mt-3 w-full rounded-xl border border-border-app/60 py-2 text-center text-xs font-semibold text-brand-light transition-colors active:bg-surface-hover"
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
          minPanelWidth={304}
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
            <Calendar className="h-4 w-4 shrink-0 text-brand-light" aria-hidden />
          </button>
        </Popover>
      </>
    );
  },
);
DatePicker.displayName = 'DatePicker';
