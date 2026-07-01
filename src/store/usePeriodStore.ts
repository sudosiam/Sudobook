import { create } from 'zustand';

export type PeriodMode = 'month' | 'all';

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
  setMode: (mode) => set({ mode }),
  setYearMonth: (year, month) => set({ year, month, mode: 'month' }),
  prev: () =>
    set((s) => {
      const d = new Date(s.year, s.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    }),
  next: () =>
    set((s) => {
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
export function periodRange(p: Pick<PeriodState, 'mode' | 'year' | 'month'>): DateRange | null {
  if (p.mode === 'all') return null;
  return {
    start: iso(new Date(p.year, p.month, 1)),
    end: iso(new Date(p.year, p.month + 1, 0)),
  };
}

/** "MMM yyyy" for month mode, "All time" otherwise. */
export function periodLabel(p: Pick<PeriodState, 'mode' | 'year' | 'month'>): string {
  if (p.mode === 'all') return 'All time';
  return new Date(p.year, p.month, 1).toLocaleString('en-IN', {
    month: 'short',
    year: 'numeric',
  });
}

/** Compact label for the picker chip, e.g. "Jul '26". */
export function periodShortLabel(p: Pick<PeriodState, 'mode' | 'year' | 'month'>): string {
  if (p.mode === 'all') return '—';
  const d = new Date(p.year, p.month, 1);
  const mon = d.toLocaleString('en-IN', { month: 'short' });
  return `${mon} '${String(p.year).slice(-2)}`;
}
