import { subtractMoney } from '@/lib/money';
import type { Purchase, PurchaseItem } from '@/lib/db';

/** Net payable (subtotal − discount) — matches stored `total` on new records. */
export function purchaseInvoiceTotal(
  purchase: Pick<Purchase, 'subtotal' | 'discount' | 'total'>,
): number {
  if (purchase.discount != null && purchase.discount > 0) {
    return Math.max(subtractMoney(purchase.subtotal, purchase.discount), 0);
  }
  return purchase.total;
}

/** Per-unit cost after bill-level discount is spread across lines (for WAC / void). */
export function effectivePurchaseUnitCost(
  item: PurchaseItem,
  subtotal: number,
  total: number,
): number {
  if (item.qty <= 0) return item.unitCost;
  if (subtotal <= 0 || total <= 0) return 0;
  if (total >= subtotal) return item.unitCost;
  const scaledLineTotal = Math.round((item.total * total) / subtotal);
  return Math.round(scaledLineTotal / item.qty);
}
