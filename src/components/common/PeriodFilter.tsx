import { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePeriodStore, periodShortLabel, type PeriodMode } from '@/store/usePeriodStore';
import { Popover } from '@/components/common/Popover';
import { MonthPickerPanel } from '@/components/common/MonthPickerSheet';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface PeriodFilterProps {
  subtitle?: string;
  className?: string;
  /** `header` = compact pill for TopBar; `inline` = toolbar row */
  placement?: 'inline' | 'header';
  /** When set, only these modes appear as toggles (default: month + fy + all). */
  modes?: PeriodMode[];
}

const pillShell =
  'inline-flex items-center rounded-full border border-border-app/50 bg-surface/95 shadow-[var(--shadow-elev-1)] backdrop-blur-sm';

const navBtn =
  'flex h-9 w-8 shrink-0 items-center justify-center text-muted transition-colors active:bg-surface-hover disabled:opacity-30 disabled:active:bg-transparent';

/** Compact month period control — premium pill in header, full-width row inline. */
export function PeriodFilter({
  subtitle,
  className,
  placement = 'inline',
  modes = ['month', 'fy', 'all'],
}: PeriodFilterProps) {
  const inHeader = placement === 'header';
  const { mode, year, month, setMode, setYearMonth, prev, next } = usePeriodStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const isAll = mode === 'all';
  const isFy = mode === 'fy';
  const navDisabled = isAll;
  const label = periodShortLabel({ mode, year, month });

  const step = (dir: -1 | 1) => {
    haptics.tap();
    setPickerOpen(false);
    if (dir < 0) prev();
    else next();
  };

  const periodControl = (
    <div className={cn(pillShell, inHeader ? 'h-9' : 'h-10 min-h-[48px]')}>
      <button
        type="button"
        aria-label={isFy ? 'Previous financial year' : 'Previous month'}
        disabled={navDisabled}
        onClick={() => step(-1)}
        className={cn(navBtn, inHeader ? 'h-9' : 'h-10 w-10')}
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>

      <button
        type="button"
        disabled={isAll}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (!isAll && !isFy) {
            haptics.tap();
            setPickerOpen((v) => !v);
          }
        }}
        className={cn(
          'flex min-w-0 flex-1 items-center justify-center gap-1 border-x border-border-app/35 px-2 font-semibold tabular-nums transition-colors',
          inHeader ? 'h-9 text-[11px]' : 'h-10 text-xs',
          isAll && 'text-muted',
          pickerOpen && !isAll && !isFy && 'text-brand-light',
        )}
        aria-label={isFy ? 'Financial year' : 'Pick month'}
        aria-expanded={pickerOpen}
      >
        <CalendarDays className={cn('shrink-0 text-brand-light', inHeader ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
        <span className="truncate">{isAll ? 'Period' : label}</span>
        {!isAll && !isFy && (
          <ChevronDown
            className={cn('shrink-0 text-muted transition-transform', pickerOpen && 'rotate-180', inHeader ? 'h-3 w-3' : 'h-3.5 w-3.5')}
          />
        )}
      </button>

      <button
        type="button"
        aria-label={isFy ? 'Next financial year' : 'Next month'}
        disabled={navDisabled}
        onClick={() => step(1)}
        className={cn(navBtn, inHeader ? 'h-9' : 'h-10 w-10')}
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
      </button>
    </div>
  );

  const modeToggle = (target: PeriodMode, chip: string) => {
    const active = mode === target;
    return (
      <button
        type="button"
        onClick={() => {
          haptics.tap();
          setPickerOpen(false);
          setMode(target);
        }}
        className={cn(
          'shrink-0 rounded-full border font-semibold uppercase tracking-wide transition-colors active:scale-[0.97]',
          inHeader ? 'h-9 px-2.5 text-[10px]' : 'min-h-[48px] px-3 text-[11px]',
          active
            ? 'border-brand bg-brand text-white shadow-[var(--shadow-glow-brand)]'
            : 'border-border-app/50 bg-surface/80 text-muted active:bg-surface-hover',
        )}
      >
        {chip}
      </button>
    );
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 overflow-visible',
        inHeader ? 'w-auto' : 'w-full flex-wrap gap-2',
        className,
      )}
    >
      {subtitle && !inHeader && (
        <span className="min-w-0 flex-1 text-[10px] leading-tight text-muted">{subtitle}</span>
      )}

      <Popover
        open={pickerOpen && mode === 'month'}
        onClose={() => setPickerOpen(false)}
        align="end"
        panelWidth={252}
        className={inHeader ? undefined : 'ml-auto'}
        panelClassName="overflow-hidden rounded-2xl border-border-app/40 shadow-[var(--shadow-elev-2)]"
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
        <div className={cn('flex items-center gap-1.5', !inHeader && 'ml-auto')}>
          {periodControl}
          {modes.includes('fy') && modeToggle('fy', 'FY')}
          {modes.includes('all') && modeToggle('all', 'All')}
        </div>
      </Popover>
    </div>
  );
}
