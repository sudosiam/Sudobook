import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthPickerPanelProps {
  year: number;
  month: number; // 0–11
  onConfirm: (year: number, month: number) => void;
}

/** Compact month grid — matches DatePicker premium styling. */
export function MonthPickerPanel({ year, month, onConfirm }: MonthPickerPanelProps) {
  const [draftYear, setDraftYear] = useState(year);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    setDraftYear(year);
  }, [year]);

  const shiftYear = (delta: number) => {
    haptics.tap();
    setDirection(delta);
    setDraftYear((y) => y + delta);
  };

  const pick = (idx: number) => {
    haptics.tap();
    onConfirm(draftYear, idx);
  };

  const now = new Date();
  const isCurrentMonth = (y: number, m: number) =>
    y === now.getFullYear() && m === now.getMonth();

  return (
    <div className="w-[15.75rem] max-w-full p-2.5">
      <div className="mb-2.5 flex items-center justify-between rounded-xl bg-app/80 px-1 py-0.5">
        <button
          type="button"
          aria-label="Previous year"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            shiftYear(-1);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors active:bg-surface-hover"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={draftYear}
            initial={{ x: direction * 12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction * -12, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="text-sm font-semibold tabular-nums tracking-tight text-foreground"
          >
            {draftYear}
          </motion.p>
        </AnimatePresence>

        <button
          type="button"
          aria-label="Next year"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            shiftYear(1);
          }}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors active:bg-surface-hover"
        >
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {MONTHS.map((label, idx) => {
          const selected = draftYear === year && idx === month;
          const current = isCurrentMonth(draftYear, idx);
          return (
            <motion.button
              key={label}
              type="button"
              whileTap={{ scale: 0.92 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                pick(idx);
              }}
              className={cn(
                'flex h-9 items-center justify-center rounded-lg text-[11px] font-semibold transition-colors',
                selected
                  ? 'bg-brand text-white shadow-[var(--shadow-glow-brand)]'
                  : current
                    ? 'text-brand-light ring-1 ring-inset ring-brand/45'
                    : 'text-foreground active:bg-surface-hover',
              )}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onConfirm(now.getFullYear(), now.getMonth());
        }}
        className="mt-2 w-full rounded-lg py-1.5 text-center text-[11px] font-semibold text-brand-light transition-colors active:bg-surface-hover"
      >
        This month
      </button>
    </div>
  );
}
