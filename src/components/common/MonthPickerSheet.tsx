import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface MonthPickerPanelProps {
  year: number;
  month: number; // 0–11
  onConfirm: (year: number, month: number) => void;
}

/** Compact month grid for the period filter popover. */
export function MonthPickerPanel({ year, month, onConfirm }: MonthPickerPanelProps) {
  const [draftYear, setDraftYear] = useState(year);

  useEffect(() => {
    setDraftYear(year);
  }, [year]);

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous year"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setDraftYear((y) => y - 1);
          }}
          className="icon-btn shrink-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold tabular-nums text-foreground">{draftYear}</p>
        <button
          type="button"
          aria-label="Next year"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setDraftYear((y) => y + 1);
          }}
          className="icon-btn shrink-0"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {MONTHS.map((label, idx) => {
          const isActive = draftYear === year && idx === month;
          return (
            <button
              key={label}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onConfirm(draftYear, idx);
              }}
              className={cn(
                'min-h-[48px] rounded-lg border text-xs font-semibold transition-colors active:scale-[0.98]',
                isActive
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-app/60 bg-surface text-foreground active:bg-surface-hover',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
