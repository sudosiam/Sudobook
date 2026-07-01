import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
  EMPTY_DASHBOARD_METRICS,
  getDashboardMetrics,
  getMonthlySeries,
  getNetWorthSeries,
  type DashboardMetrics,
  type MonthPoint,
  type NetWorthPoint,
} from '@/lib/reports';
import { fyDateRange } from '@/lib/sequences';
import { useAppStore } from '@/store/useAppStore';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';

/** Dashboard metrics recomputed whenever journal entries or period change. */
export function useFinancials(): {
  metrics: DashboardMetrics;
  series: MonthPoint[];
  netWorthSeries: NetWorthPoint[];
} {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });

  const metrics = useLiveQuery(async () => {
    await db.journalEntries.count();
    if (range) {
      return getDashboardMetrics(range.start, range.end);
    }
    const { start, end } = fyDateRange(currentFY);
    return getDashboardMetrics(start, end);
  }, [range?.start, range?.end, currentFY], EMPTY_DASHBOARD_METRICS);

  const series = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getMonthlySeries(12);
  }, [], []);

  const netWorthSeries = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getNetWorthSeries(12);
  }, [], []);

  return {
    metrics: metrics ?? EMPTY_DASHBOARD_METRICS,
    series: series ?? [],
    netWorthSeries: netWorthSeries ?? [],
  };
}
