import { create } from 'zustand';
import { fyDateRange, getFYStartYear } from '@/lib/sequences';

export type PeriodMode = 'month' | 'fy' | 'all';

interface PeriodState {
  mode: PeriodMode;
  year: number;
  month: number; // 0-11
  setMode: (mode: PeriodMode) => void;
  setYearMonth: (year: number, month: number) => void;
  prev: () => void;
  next: () => void;
}

const today = new Date();

/**
 * App-wide period selector shared by list views and reports so a single
 * "monthly filter" controls everything consistently.
 */
export const usePeriodStore = create<PeriodState>((set) => ({
  mode: 'month',
  year: today.getFullYear(),
  month: today.getMonth(),
  setMode: (mode) =>
    set((s) => {
      if (mode === 'fy') {
        return { mode, year: getFYStartYear() };
      }
      if (mode === 'month' && s.mode === 'fy') {
        return { mode, year: today.getFullYear(), month: today.getMonth() };
      }
      return { mode };
    }),
  setYearMonth: (year, month) => set({ year, month, mode: 'month' }),
  prev: () =>
    set((s) => {
      if (s.mode === 'fy') return { year: s.year - 1 };
      const d = new Date(s.year, s.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    }),
  next: () =>
    set((s) => {
      if (s.mode === 'fy') return { year: s.year + 1 };
      const d = new Date(s.year, s.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    }),
}));

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DateRange {
  start: string;
  end: string;
}

/** Inclusive ISO date range for the selected period, or null for "all time". */
export function periodRange(
  p: Pick<PeriodState, 'mode' | 'year' | 'month'>,
): DateRange | null {
  if (p.mode === 'all') return null;
  if (p.mode === 'fy') {
    const fy = `${p.year}-${String((p.year + 1) % 100).padStart(2, '0')}`;
    return fyDateRange(fy);
  }
  if (p.mode === 'month') {
    return {
      start: iso(new Date(p.year, p.month, 1)),
      end: iso(new Date(p.year, p.month + 1, 0)),
    };
  }
  return null;
}

/** "MMM yyyy" for month mode, FY label, or "All time". */
export function periodLabel(
  p: Pick<PeriodState, 'mode' | 'year' | 'month'>,
): string {
  if (p.mode === 'all') return 'All time';
  if (p.mode === 'fy') {
    return `FY ${p.year}-${String((p.year + 1) % 100).padStart(2, '0')}`;
  }
  return new Date(p.year, p.month, 1).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

/** Compact label for the picker chip, e.g. "Jul '26" or "FY '25-26". */
export function periodShortLabel(p: Pick<PeriodState, 'mode' | 'year' | 'month'>): string {
  if (p.mode === 'all') return '—';
  if (p.mode === 'fy') {
    return `FY '${String(p.year).slice(-2)}-${String((p.year + 1) % 100).padStart(2, '0')}`;
  }
  const d = new Date(p.year, p.month, 1);
  const mon = d.toLocaleString('en-IN', { month: 'short' });
  return `${mon} '${String(p.year).slice(-2)}`;
}
