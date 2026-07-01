import type { Sale } from '@/lib/db';
import { addMoney, multiplyMoney, subtractMoney } from '@/lib/money';

/** Customer invoice total (subtotal − discount) — not gross profit. */
export function saleInvoiceTotal(sale: Sale): number {
  return Math.max(subtractMoney(sale.subtotal, sale.discount), 0);
}

/** COGS captured on each line item at time of sale. Returns paise. */
export function saleCogs(sale: Sale): number {
  return addMoney(...sale.items.map((item) => multiplyMoney(item.costPrice, item.qty)));
}

/** Gross profit = sale total − COGS. Returns paise. */
export function saleGrossProfit(sale: Sale): number {
  return subtractMoney(sale.total, saleCogs(sale));
}

/** Gross margin as a whole-number percentage (0–100). */
export function saleGrossMarginPct(sale: Sale): number {
  if (sale.total <= 0) return 0;
  return Math.round((saleGrossProfit(sale) / sale.total) * 100);
}
