import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import {
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
  metrics: DashboardMetrics | undefined;
  series: MonthPoint[] | undefined;
  netWorthSeries: NetWorthPoint[] | undefined;
} {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });

  const metrics = useLiveQuery(async () => {
    // Depend on journalEntries so the query re-runs on any posting.
    await db.journalEntries.count();
    if (range) {
      return getDashboardMetrics(range.start, range.end);
    }
    const { start, end } = fyDateRange(currentFY);
    return getDashboardMetrics(start, end);
  }, [range?.start, range?.end, currentFY]);

  const series = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getMonthlySeries(6);
  }, []);

  const netWorthSeries = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getNetWorthSeries(6);
  }, []);

  return {
    metrics,
    series,
    netWorthSeries,
  };
}
