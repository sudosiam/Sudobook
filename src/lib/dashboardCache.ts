import { db, now } from '@/lib/db';
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
import type { DateRange } from '@/store/usePeriodStore';

export interface DashboardCacheEntry {
  id: string;
  metrics: DashboardMetrics;
  monthlySeries: MonthPoint[];
  netWorthSeries: NetWorthPoint[];
  dashboardRevision: number;
  updatedAt: string;
}

export interface DashboardBundle {
  metrics: DashboardMetrics;
  monthlySeries: MonthPoint[];
  netWorthSeries: NetWorthPoint[];
}

export function buildDashboardCacheKey(
  currentFY: string,
  range: DateRange | null,
): string {
  if (range) return `range:${range.start}:${range.end}`;
  return `fy:${currentFY}`;
}

export async function bumpDashboardRevisionTx(): Promise<void> {
  const s = await db.settings.get('singleton');
  if (!s) return;
  await db.settings.update('singleton', { dashboardRevision: (s.dashboardRevision ?? 0) + 1 });
}

export async function bumpDashboardRevision(): Promise<void> {
  await db.transaction('rw', db.settings, () => bumpDashboardRevisionTx());
}

async function currentRevision(): Promise<number> {
  const s = await db.settings.get('singleton');
  return s?.dashboardRevision ?? 0;
}

export async function computeDashboardBundle(
  currentFY: string,
  range: DateRange | null,
): Promise<DashboardBundle> {
  const { start, end } = range ?? fyDateRange(currentFY);
  const [metrics, monthlySeries, netWorthSeries] = await Promise.all([
    getDashboardMetrics(start, end),
    getMonthlySeries(12),
    getNetWorthSeries(12),
  ]);
  return { metrics, monthlySeries, netWorthSeries };
}

async function readDashboardCache(id: string, revision: number): Promise<DashboardBundle | null> {
  try {
    const cached = await db.dashboardCache.get(id);
    if (cached && cached.dashboardRevision === revision) {
      return {
        metrics: cached.metrics,
        monthlySeries: cached.monthlySeries,
        netWorthSeries: cached.netWorthSeries,
      };
    }
  } catch (err) {
    console.warn('[dashboardCache] read failed', err);
  }
  return null;
}

/** Persist outside useLiveQuery — Dexie live queries must stay read-only. */
export async function persistDashboardCache(
  currentFY: string,
  range: DateRange | null,
  bundle: DashboardBundle,
): Promise<void> {
  const id = buildDashboardCacheKey(currentFY, range);
  const revision = await currentRevision();
  const entry: DashboardCacheEntry = {
    id,
    ...bundle,
    dashboardRevision: revision,
    updatedAt: now(),
  };
  try {
    await db.dashboardCache.put(entry);
  } catch (err) {
    console.warn('[dashboardCache] persist failed', err);
  }
}

/**
 * Read-through cache for dashboard UI. Never writes — safe inside useLiveQuery.
 */
export async function getDashboardBundleCached(
  currentFY: string,
  range: DateRange | null,
): Promise<{ bundle: DashboardBundle; shouldPersist: boolean }> {
  const id = buildDashboardCacheKey(currentFY, range);
  const revision = await currentRevision();
  const hit = await readDashboardCache(id, revision);
  if (hit) return { bundle: hit, shouldPersist: false };
  const bundle = await computeDashboardBundle(currentFY, range);
  return { bundle, shouldPersist: true };
}

export const EMPTY_DASHBOARD_BUNDLE: DashboardBundle = {
  metrics: EMPTY_DASHBOARD_METRICS,
  monthlySeries: [],
  netWorthSeries: [],
};
