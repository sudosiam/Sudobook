import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePeriodStore, periodShortLabel } from '@/store/usePeriodStore';
import { Popover } from '@/components/common/Popover';
import { MonthPickerPanel } from '@/components/common/MonthPickerSheet';
import { cn } from '@/lib/utils';

interface PeriodFilterProps {
  subtitle?: string;
  className?: string;
  /** `header` = compact chip for TopBar right slot; `inline` = full-width toolbar row */
  placement?: 'inline' | 'header';
}

/** Inline month chip — tap label to open month grid popover. */
export function PeriodFilter({ subtitle, className, placement = 'inline' }: PeriodFilterProps) {
  const inHeader = placement === 'header';
  const { mode, year, month, setMode, setYearMonth, prev, next } = usePeriodStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isAll = mode === 'all';
  const label = periodShortLabel({ mode, year, month });

  return (
    <div className={cn('period-filter-wrap', inHeader && 'period-filter-wrap--header', className)}>
      {subtitle && !inHeader && <span className="period-filter__subtitle">{subtitle}</span>}
      <Popover
        open={pickerOpen && !isAll}
        onClose={() => setPickerOpen(false)}
        align="end"
        panelWidth={280}
        className={inHeader ? undefined : 'ml-auto'}
        panel={
          <MonthPickerPanel
            year={year}
            month={month}
            onConfirm={(y, m) => {
              setYearMonth(y, m);
              setPickerOpen(false);
            }}
          />
        }
      >
        <div className={cn('period-filter', inHeader && 'period-filter--header')} role="group" aria-label="Period">
          <button
            type="button"
            aria-label="Previous month"
            disabled={isAll}
            onClick={() => {
              setPickerOpen(false);
              prev();
            }}
            className="period-filter__chev"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={isAll}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (!isAll) setPickerOpen((v) => !v);
            }}
            className={cn(
              'period-filter__month',
              isAll && 'period-filter__month--disabled',
              pickerOpen && !isAll && 'bg-surface-hover text-brand-light',
            )}
            aria-label="Pick month"
            aria-expanded={pickerOpen}
          >
            {label}
          </button>

          <button
            type="button"
            aria-label="Next month"
            disabled={isAll}
            onClick={() => {
              setPickerOpen(false);
              next();
            }}
            className="period-filter__chev"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              setMode(isAll ? 'month' : 'all');
            }}
            className={cn('period-filter__all', isAll && 'period-filter__all--active')}
          >
            All
          </button>
        </div>
      </Popover>
    </div>
  );
}
