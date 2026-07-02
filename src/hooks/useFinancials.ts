import { useEffect } from 'react';
import { useStaleLiveQuery } from '@/hooks/useStaleLiveQuery';
import { db } from '@/lib/db';
import {
  EMPTY_DASHBOARD_BUNDLE,
  getDashboardBundleCached,
  persistDashboardCache,
  type DashboardBundle,
} from '@/lib/dashboardCache';
import {
  EMPTY_DASHBOARD_METRICS,
  type DashboardMetrics,
  type MonthPoint,
  type NetWorthPoint,
} from '@/lib/reports';
import { useAppStore } from '@/store/useAppStore';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';

/** Dashboard metrics with Dexie cache + stale-while-revalidate. */
export function useFinancials(): {
  metrics: DashboardMetrics;
  series: MonthPoint[];
  netWorthSeries: NetWorthPoint[];
  isInitialLoad: boolean;
} {
  const currentFY = useAppStore((s) => s.currentFY);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });

  const result = useStaleLiveQuery(async () => {
    await db.journalEntries.count();
    return getDashboardBundleCached(currentFY, range);
  }, [currentFY, range?.start, range?.end, mode]);

  useEffect(() => {
    if (!result?.shouldPersist) return;
    void persistDashboardCache(currentFY, range, result.bundle);
  }, [result, currentFY, range]);

  const bundle: DashboardBundle | undefined = result?.bundle;
  const resolved = bundle ?? EMPTY_DASHBOARD_BUNDLE;
  const isInitialLoad = bundle === undefined;

  return {
    metrics: resolved.metrics ?? EMPTY_DASHBOARD_METRICS,
    series: resolved.monthlySeries ?? [],
    netWorthSeries: resolved.netWorthSeries ?? [],
    isInitialLoad,
  };
}
