/**
 * Paise-integer arithmetic engine. The ONLY place money math happens.
 * Every monetary value in Sudo Books is an INTEGER number of paise (₹1 = 100).
 * Floating-point currency math is forbidden everywhere else in the codebase.
 */

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

/** Format paise (integer) as a full ₹X,XX,XXX.XX string. */
export const toINR = (paise: number): string => inrFormatter.format(paise / 100);

/** Compact format for dashboards, e.g. 420000 paise → "₹4.2K". */
export const toINRCompact = (paise: number): string =>
  `₹${compactFormatter.format(paise / 100)}`;

/** Convert user rupee input (string or number) to integer paise. */
export const toPaise = (rupees: string | number): number => {
  const raw = typeof rupees === 'string' ? rupees.replace(/,/g, '').trim() : String(rupees);
  if (raw === '' || raw === '.') return 0;
  const n = typeof rupees === 'string' ? Number(raw) : rupees;
  if (!Number.isFinite(n)) {
    console.warn('[toPaise] Invalid amount — treated as 0:', rupees);
    return 0;
  }
  return Math.round(n * 100);
};

/** Convert integer paise back to a plain rupee number (for inputs, never for math). */
export const paiseToRupees = (paise: number): number => Math.round(paise) / 100;

/** Safe integer summation of paise amounts. */
export const addMoney = (...amounts: number[]): number =>
  amounts.reduce((sum, a) => sum + a, 0);

/** Safe integer subtraction of paise amounts. */
export const subtractMoney = (a: number, b: number): number => a - b;

/** Percentage of a paise amount, rounded immediately to an integer. */
export const pct = (amount: number, ratePercent: number): number =>
  Math.round((amount * ratePercent) / 100);

/** Multiply a paise amount by an integer quantity. */
export const multiplyMoney = (amount: number, qty: number): number => Math.round(amount * qty);

/**
 * Weighted-average unit cost (paise) after adding new stock.
 * newAvg = (oldQty*oldCost + addQty*addCost) / (oldQty + addQty), rounded to paise.
 * Falls back to the incoming cost when there is no meaningful prior stock.
 */
export const weightedAverageCost = (
  oldQty: number,
  oldCost: number,
  addQty: number,
  addCost: number,
): number => {
  const totalQty = oldQty + addQty;
  if (totalQty <= 0) return addCost;
  if (oldQty <= 0) return addCost;
  return Math.round((oldQty * oldCost + addQty * addCost) / totalQty);
};

/** Undo weighted-average cost after removing stock (e.g. voiding a purchase). */
export const reverseWeightedAverageCost = (
  afterQty: number,
  afterCost: number,
  removeQty: number,
  removeCost: number,
): number => {
  const beforeQty = afterQty - removeQty;
  if (beforeQty <= 0) return removeCost;
  const totalValue = afterQty * afterCost - removeQty * removeCost;
  if (totalValue <= 0) return removeCost;
  return Math.round(totalValue / beforeQty);
};

/** True when the value is a valid non-negative integer paise amount. */
export const isValidPaise = (value: number): boolean =>
  Number.isInteger(value) && value >= 0;
