import { db, activeWhere, type DocStatus, type PaymentMethod, type Product, type Sale } from '@/lib/db';
import type { DateRange } from '@/store/usePeriodStore';

const DEFAULT_PAGE = 50;

function matchesSaleSearch(s: Sale, needle: string): boolean {
  if (!needle) return true;
  return (
    s.customerName.toLowerCase().includes(needle) ||
    s.saleNumber.toLowerCase().includes(needle)
  );
}

function matchesProductSearch(p: Product, needle: string): boolean {
  if (!needle) return true;
  return p.name.toLowerCase().includes(needle) || p.sku.toLowerCase().includes(needle);
}

/** Stream sales newest-first, stopping once `maxCount` matches are collected. */
export async function querySalesPage(
  maxCount: number,
  range: DateRange | null,
  statusFilter: '' | DocStatus,
  paymentFilter: '' | PaymentMethod,
  search: string,
): Promise<Sale[]> {
  const needle = search.trim().toLowerCase();
  const results: Sale[] = [];

  const source = range
    ? db.sales.where('date').between(range.start, range.end, true, true).reverse()
    : db.sales.orderBy('date').reverse();

  await source.each((s) => {
    if (statusFilter && s.status !== statusFilter) return;
    if (paymentFilter && s.paymentMethod !== paymentFilter) return;
    if (!matchesSaleSearch(s, needle)) return;
    results.push(s);
    if (results.length >= maxCount) return false;
  });

  return results;
}

/** Stream active products, sorted by name, up to `maxCount` matches. */
export async function queryProductsPage(
  maxCount: number,
  categoryFilter: string | null,
  search: string,
): Promise<Product[]> {
  const needle = search.trim().toLowerCase();
  const results: Product[] = [];

  const source = categoryFilter
    ? db.products.where('category').equals(categoryFilter).filter((p) => p.isActive)
    : activeWhere(db.products);

  await source.each((p) => {
    if (!matchesProductSearch(p, needle)) return;
    results.push(p);
  });

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results.slice(0, maxCount);
}

/** Cheap total for sales in range (for header count when unfiltered). */
export async function countSalesInRange(range: DateRange | null): Promise<number> {
  if (range) {
    return db.sales.where('date').between(range.start, range.end, true, true).count();
  }
  return db.sales.count();
}

export { DEFAULT_PAGE as LIST_PAGE_SIZE };
