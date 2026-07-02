import { db, activeWhere } from '@/lib/db';
import { foldPostedJournalLines, getAllBalances, getPeriodBalances, getRangeBalance } from '@/lib/accounting';
import { filterActiveBankTxns } from '@/lib/transactions';
import { CODES } from '@/lib/coa';
import { addMoney, multiplyMoney, subtractMoney } from '@/lib/money';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export interface ReportLine {
  code: number;
  name: string;
  amount: number; // paise
}

// ─── P&L ──────────────────────────────────────────────────────

export interface ProfitLoss {
  income: ReportLine[];
  totalRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  expenses: ReportLine[];
  totalExpenses: number;
  netProfit: number;
  netMarginPct: number;
}

export async function getProfitLoss(start: string, end: string): Promise<ProfitLoss> {
  const accounts = await db.accounts.toArray();
  const nameOf = (code: number) => accounts.find((a) => a.code === code)?.name ?? `#${code}`;

  const balances = await getPeriodBalances(start, end);

  const income: ReportLine[] = [];
  const expenses: ReportLine[] = [];
  let cogs = 0;

  for (const [code, bal] of balances) {
    if (code >= 400 && code < 500) {
      income.push({ code, name: nameOf(code), amount: bal.balance });
    } else if (code === CODES.COGS) {
      cogs += bal.balance;
    } else if (code >= 502 && code < 600) {
      expenses.push({ code, name: nameOf(code), amount: bal.balance });
    }
  }

  income.sort((a, b) => a.code - b.code);
  expenses.sort((a, b) => a.code - b.code);

  const totalRevenue = addMoney(...income.map((i) => i.amount));
  const grossProfit = totalRevenue - cogs;
  const totalExpenses = addMoney(...expenses.map((e) => e.amount));
  const netProfit = grossProfit - totalExpenses;

  return {
    income,
    totalRevenue,
    cogs,
    grossProfit,
    grossMarginPct: totalRevenue ? Math.round((grossProfit / totalRevenue) * 100) : 0,
    expenses,
    totalExpenses,
    netProfit,
    netMarginPct: totalRevenue ? Math.round((netProfit / totalRevenue) * 100) : 0,
  };
}


// ─── BALANCE SHEET ────────────────────────────────────────────

export interface BalanceSheet {
  assets: ReportLine[];
  totalAssets: number;
  liabilities: ReportLine[];
  totalLiabilities: number;
  equity: ReportLine[];
  /** Accumulated profit from prior (closed) financial years. */
  priorProfit: number;
  /** Profit for the current financial year. */
  currentProfit: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
}

export async function getBalanceSheet(asOf: string, fyStart: string): Promise<BalanceSheet> {
  const accounts = await db.accounts.toArray();
  const nameOf = (code: number) => accounts.find((a) => a.code === code)?.name ?? `#${code}`;
  const balances = await getAllBalances(asOf);

  const assets: ReportLine[] = [];
  const liabilities: ReportLine[] = [];
  const equity: ReportLine[] = [];

  for (const [code, bal] of balances) {
    if (code >= 100 && code < 200) {
      assets.push({ code, name: nameOf(code), amount: bal.balance });
    } else if (code >= 200 && code < 300) {
      liabilities.push({ code, name: nameOf(code), amount: bal.balance });
    } else if (code >= 300 && code < 400) {
      equity.push({ code, name: nameOf(code), amount: bal.balance });
    }
  }

  assets.sort((a, b) => a.code - b.code);
  liabilities.sort((a, b) => a.code - b.code);
  equity.sort((a, b) => a.code - b.code);

  const totalAssets = addMoney(...assets.map((a) => a.amount));
  const totalLiabilities = addMoney(...liabilities.map((l) => l.amount));

  // Accounting identity: Assets = Liabilities + Equity + (Income − Expenses),
  // where Income − Expenses is the ALL-TIME accumulated profit up to `asOf`.
  // Adding the full accumulated profit (not just the current FY) keeps the
  // sheet balanced across financial-year boundaries without needing explicit
  // year-end closing entries. We still split it for display.
  const income = await getRangeBalance(400, 499, asOf);
  const expensesAndCogs = await getRangeBalance(500, 599, asOf);
  const accumulatedProfit = income - expensesAndCogs;

  const openingIncome = await getRangeBalance(400, 499, dayBefore(fyStart));
  const openingExp = await getRangeBalance(500, 599, dayBefore(fyStart));
  const currentProfit = accumulatedProfit - (openingIncome - openingExp);
  const priorProfit = accumulatedProfit - currentProfit;

  const totalEquity = addMoney(...equity.map((e) => e.amount)) + accumulatedProfit;

  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    priorProfit,
    currentProfit,
    totalEquity,
    totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
    balanced: totalAssets === totalLiabilities + totalEquity,
  };
}

function dayBefore(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── TRIAL BALANCE ────────────────────────────────────────────

export interface TrialBalanceRow {
  code: number;
  name: string;
  debit: number;
  credit: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export async function getTrialBalance(asOf?: string): Promise<TrialBalance> {
  const accounts = await db.accounts.toArray();
  const nameOf = (code: number) => accounts.find((a) => a.code === code)?.name ?? `#${code}`;
  const balances = await getAllBalances(asOf);

  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (const [code, bal] of balances) {
    if (bal.debit === 0 && bal.credit === 0) continue;
    rows.push({ code, name: nameOf(code), debit: bal.debit, credit: bal.credit });
    totalDebit += bal.debit;
    totalCredit += bal.credit;
  }

  rows.sort((a, b) => a.code - b.code);

  let ledgerDebit = 0;
  let ledgerCredit = 0;
  await foldPostedJournalLines({ upToDate: asOf }, (_code, dr, cr) => {
    ledgerDebit += dr;
    ledgerCredit += cr;
  });

  const trialBalanced = totalDebit === totalCredit;
  const ledgerBalanced = ledgerDebit === ledgerCredit;
  return {
    rows,
    totalDebit,
    totalCredit,
    balanced: trialBalanced && ledgerBalanced,
  };
}

// ─── CASH FLOW (simplified) ───────────────────────────────────

export interface CashFlow {
  opening: number;
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  closing: number;
  /** Gross cash/bank debits in the period (inflows) */
  totalDebit: number;
  /** Gross cash/bank credits in the period (outflows) */
  totalCredit: number;
  /** totalDebit − totalCredit */
  net: number;
}

export async function getCashFlow(start: string, end: string): Promise<CashFlow> {
  const opening = await cashAndBankBalance(dayBefore(start));
  const closing = await cashAndBankBalance(end);
  const netChange = closing - opening;

  // Classify by counter-account of each cash/bank movement in the period.
  let operating = 0;
  let financing = 0;
  let investing = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const isCash = (code: number) => code === CODES.CASH || code === CODES.BANK;

  await db.journalEntries
    .where('date')
    .between(start, end, true, true)
    .each((e) => {
    if (e.status !== 'posted') return;

    // Net effect on cash + bank across ALL legs (handles multi-line entries and
    // nets internal cash↔bank transfers to zero).
    let cashDelta = 0;
    let hasCash = false;
    for (const l of e.lines) {
      if (isCash(l.accountCode)) {
        totalDebit += l.debit;
        totalCredit += l.credit;
        cashDelta += l.debit - l.credit;
        hasCash = true;
      }
    }
    if (!hasCash || cashDelta === 0) return;

    // Classify by entry type first, then fall back to counter-account heuristics.
    if (e.entryType === 'opening') {
      financing += cashDelta;
      return;
    }
    if (e.entryType === 'adjustment' && e.lines.some((l) => l.accountCode === CODES.FIXED_ASSETS)) {
      investing += cashDelta;
      return;
    }
    if (
      e.entryType === 'sale' ||
      e.entryType === 'purchase' ||
      e.entryType === 'expense' ||
      e.entryType === 'receipt' ||
      e.entryType === 'payment' ||
      e.entryType === 'transfer'
    ) {
      operating += cashDelta;
      return;
    }

    // Classify by the largest non-cash counter account in the entry.
    let counterCode = 0;
    let maxMag = -1;
    for (const l of e.lines) {
      if (isCash(l.accountCode)) continue;
      const mag = l.debit + l.credit;
      if (mag > maxMag) {
        maxMag = mag;
        counterCode = l.accountCode;
      }
    }

    if (counterCode >= 300 && counterCode < 400) financing += cashDelta;
    else if (counterCode === CODES.FIXED_ASSETS) investing += cashDelta;
    else if (counterCode === CODES.LOANS || counterCode === CODES.CREDIT_CARDS) financing += cashDelta;
    else operating += cashDelta;
  });

  return {
    opening,
    operating,
    investing,
    financing,
    netChange,
    closing,
    totalDebit,
    totalCredit,
    net: subtractMoney(totalDebit, totalCredit),
  };
}

async function cashAndBankBalance(asOf: string): Promise<number> {
  const balances = await getAllBalances(asOf);
  return (balances.get(CODES.CASH)?.balance ?? 0) + (balances.get(CODES.BANK)?.balance ?? 0);
}

// ─── DASHBOARD METRICS ────────────────────────────────────────

export interface DashboardMetrics {
  netWorth: number;
  /** Operating value: cash + bank + receivable + inventory − payable */
  businessValue: number;
  cash: number;
  bank: number;
  receivable: number;
  payable: number;
  inventory: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  /** Account 402 — other income for the selected period */
  otherIncome: number;
  /** Cash in hand + bank accounts */
  totalLiquid: number;
}

export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  netWorth: 0,
  businessValue: 0,
  cash: 0,
  bank: 0,
  receivable: 0,
  payable: 0,
  inventory: 0,
  revenue: 0,
  cogs: 0,
  grossProfit: 0,
  operatingExpenses: 0,
  netProfit: 0,
  otherIncome: 0,
  totalLiquid: 0,
};

export async function getDashboardMetrics(
  fyStart: string,
  fyEnd: string,
): Promise<DashboardMetrics> {
  const balances = await getAllBalances(fyEnd);
  const cash = balances.get(CODES.CASH)?.balance ?? 0;
  const bank = balances.get(CODES.BANK)?.balance ?? 0;
  const receivable = balances.get(CODES.RECEIVABLE)?.balance ?? 0;
  const payable = balances.get(CODES.PAYABLE)?.balance ?? 0;
  const inventory = balances.get(CODES.INVENTORY)?.balance ?? 0;

  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const [code, bal] of balances) {
    if (code >= 100 && code < 200) totalAssets += bal.balance;
    else if (code >= 200 && code < 300) totalLiabilities += bal.balance;
  }

  const pl = await getProfitLoss(fyStart, fyEnd);
  const otherIncome = pl.income.find((i) => i.code === CODES.OTHER_INCOME)?.amount ?? 0;

  const netWorth = totalAssets - totalLiabilities;
  const businessValue = subtractMoney(addMoney(cash, bank, receivable, inventory), payable);
  const totalLiquid = addMoney(cash, bank);

  return {
    netWorth,
    businessValue,
    cash,
    bank,
    receivable,
    payable,
    inventory,
    revenue: pl.totalRevenue,
    cogs: pl.cogs,
    grossProfit: pl.grossProfit,
    operatingExpenses: pl.totalExpenses,
    netProfit: pl.netProfit,
    otherIncome,
    totalLiquid,
  };
}

// ─── MONTHLY SERIES (charts) ──────────────────────────────────

export interface MonthPoint {
  month: string; // "Apr"
  key: string; // "2024-04"
  revenue: number; // paise
  cogs: number; // paise
  expenses: number; // paise — operating expenses (502–599)
  profit: number; // paise — net profit (revenue − cogs − expenses)
}

export async function getMonthlySeries(months = 6): Promise<MonthPoint[]> {
  const points: MonthPoint[] = [];
  const base = new Date();
  base.setDate(1);

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const monthEnd = new Date(base.getFullYear(), base.getMonth() - i + 1, 0);
    const start = monthStart.toISOString().slice(0, 10);
    const end = monthEnd.toISOString().slice(0, 10);
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    const label = monthStart.toLocaleString('en-IN', { month: 'short' });

    let revenue = 0;
    let cogs = 0;
    let expenses = 0;
    await foldPostedJournalLines({ start, end }, (accountCode, debit, credit) => {
      if (accountCode >= 400 && accountCode < 500) revenue += credit - debit;
      else if (accountCode === CODES.COGS) cogs += debit - credit;
      else if (accountCode >= 502 && accountCode < 600) expenses += debit - credit;
    });

    points.push({
      month: label,
      key,
      revenue,
      cogs,
      expenses,
      profit: revenue - cogs - expenses,
    });
  }
  return points;
}

// ─── PARTY BALANCES ───────────────────────────────────────────

export async function getCustomerBalance(customerId: string): Promise<number> {
  const customer = await db.customers.get(customerId);
  if (!customer) return 0;

  let balance = customer.openingBalance;
  const sales = await db.sales.where('customerId').equals(customerId).toArray();
  balance = addMoney(balance, ...sales.filter((s) => s.status !== 'void').map((s) => s.dueAmount));
  return balance;
}

export async function getVendorBalance(vendorId: string): Promise<number> {
  const vendor = await db.vendors.get(vendorId);
  if (!vendor) return 0;

  let balance = vendor.openingBalance;
  const purchases = await db.purchases.where('vendorId').equals(vendorId).toArray();
  balance = addMoney(balance, ...purchases.filter((p) => p.status !== 'void').map((p) => p.dueAmount));
  return balance;
}

export async function getBankBalance(bankAccountId: string): Promise<number> {
  const bank = await db.bankAccounts.get(bankAccountId);
  if (!bank) return 0;
  const txns = filterActiveBankTxns(
    await db.bankTransactions.where('bankAccountId').equals(bankAccountId).toArray(),
  );
  let balance = bank.openingBalance;
  for (const t of txns) balance += t.type === 'credit' ? t.amount : -t.amount;
  return balance;
}

export interface BankTxnWithBalance {
  id: string;
  date: string;
  description: string;
  reference: string;
  type: 'credit' | 'debit';
  amount: number; // paise
  runningBalance: number; // paise — balance after this txn (chronological)
}

/** Bank transactions newest-first, each with running book balance after that entry. */
export async function getBankTransactionsWithBalance(
  bankAccountId: string,
): Promise<BankTxnWithBalance[]> {
  const bank = await db.bankAccounts.get(bankAccountId);
  if (!bank) return [];

  const txns = filterActiveBankTxns(
    await db.bankTransactions.where('bankAccountId').equals(bankAccountId).toArray(),
  );
  const sorted = [...txns].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byRef = a.reference.localeCompare(b.reference);
    if (byRef !== 0) return byRef;
    return a.id.localeCompare(b.id);
  });

  let balance = bank.openingBalance; // paise
  const chronological: BankTxnWithBalance[] = sorted.map((t) => {
    balance += t.type === 'credit' ? t.amount : -t.amount;
    return {
      id: t.id,
      date: t.date,
      description: t.description,
      reference: t.reference,
      type: t.type,
      amount: t.amount,
      runningBalance: balance,
    };
  });

  return chronological.reverse();
}

// ─── AGING REPORTS ────────────────────────────────────────────

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export const AGING_BUCKETS: AgingBucket[] = ['0-30', '31-60', '61-90', '90+'];

export interface AgingRow {
  partyId: string;
  partyName: string;
  buckets: Record<AgingBucket, number>;
  total: number; // paise
}

export interface AgingReport {
  rows: AgingRow[];
  totals: Record<AgingBucket, number>;
  grandTotal: number; // paise
}

function emptyBuckets(): Record<AgingBucket, number> {
  return { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
}

function daysSince(dateStr: string, asOf: Date): number {
  return differenceInCalendarDays(asOf, parseISO(dateStr));
}

function bucketForDays(days: number): AgingBucket {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

function buildAgingReport(
  rows: AgingRow[],
): AgingReport {
  const totals = emptyBuckets();
  for (const row of rows) {
    for (const b of AGING_BUCKETS) totals[b] += row.buckets[b];
  }
  return {
    rows: rows.sort((a, b) => b.total - a.total),
    totals,
    grandTotal: addMoney(...AGING_BUCKETS.map((b) => totals[b])),
  };
}

/** Receivables aging by customer — buckets based on sale date vs as-of date. */
export async function getCustomerAging(asOf?: string): Promise<AgingReport> {
  const ref = asOf ? parseISO(asOf) : new Date();
  const customers = await activeWhere(db.customers).toArray();
  const rows: AgingRow[] = [];

  for (const c of customers) {
    const buckets = emptyBuckets();

    const sales = await db.sales.where('customerId').equals(c.id).toArray();
    for (const s of sales) {
      if (s.status === 'void' || s.dueAmount <= 0) continue;
      buckets[bucketForDays(daysSince(s.date, ref))] += s.dueAmount;
    }

    const total = addMoney(...AGING_BUCKETS.map((b) => buckets[b]));
    if (total > 0) rows.push({ partyId: c.id, partyName: c.name, buckets, total });
  }

  return buildAgingReport(rows);
}

/** Payables aging by vendor — buckets based on purchase date vs as-of date. */
export async function getVendorAging(asOf?: string): Promise<AgingReport> {
  const ref = asOf ? parseISO(asOf) : new Date();
  const vendors = await activeWhere(db.vendors).toArray();
  const rows: AgingRow[] = [];

  for (const v of vendors) {
    const buckets = emptyBuckets();

    const purchases = await db.purchases.where('vendorId').equals(v.id).toArray();
    for (const p of purchases) {
      if (p.status === 'void' || p.dueAmount <= 0) continue;
      buckets[bucketForDays(daysSince(p.date, ref))] += p.dueAmount;
    }

    const total = addMoney(...AGING_BUCKETS.map((b) => buckets[b]));
    if (total > 0) rows.push({ partyId: v.id, partyName: v.name, buckets, total });
  }

  return buildAgingReport(rows);
}

// ─── SALES / PURCHASE REPORTS ─────────────────────────────────

export interface PaymentMethodBreakdown {
  method: string;
  count: number;
  total: number; // paise
}

export interface ProductBreakdown {
  productId: string;
  productName: string;
  qty: number;
  total: number; // paise
}

export interface PartyBreakdown {
  partyId: string;
  partyName: string;
  count: number;
  total: number; // paise
}

export interface SalesReportSummary {
  count: number;
  subtotal: number; // paise
  discount: number; // paise
  total: number; // paise
  paid: number; // paise
  due: number; // paise
  byPaymentMethod: PaymentMethodBreakdown[];
  byProduct: ProductBreakdown[];
  byCustomer: PartyBreakdown[];
}

export interface PurchaseReportSummary {
  count: number;
  subtotal: number; // paise
  discount: number; // paise
  total: number; // paise
  paid: number; // paise
  due: number; // paise
  byPaymentMethod: PaymentMethodBreakdown[];
  byProduct: ProductBreakdown[];
  byVendor: PartyBreakdown[];
}

export async function getSalesReport(start: string, end: string): Promise<SalesReportSummary> {
  const sales = (await db.sales.where('date').between(start, end, true, true).toArray()).filter(
    (s) => s.status !== 'void',
  );

  const methodMap = new Map<string, PaymentMethodBreakdown>();
  const productMap = new Map<string, ProductBreakdown>();
  const customerMap = new Map<string, PartyBreakdown>();

  for (const s of sales) {
    const m = methodMap.get(s.paymentMethod) ?? {
      method: s.paymentMethod,
      count: 0,
      total: 0,
    };
    m.count += 1;
    m.total += s.total;
    methodMap.set(s.paymentMethod, m);

    const cid = s.customerId ?? '__cash__';
    const cname = s.customerId ? s.customerName : 'Walk-in / Cash';
    const c = customerMap.get(cid) ?? { partyId: cid, partyName: cname, count: 0, total: 0 };
    c.count += 1;
    c.total += s.total;
    customerMap.set(cid, c);

    for (const it of s.items) {
      const p = productMap.get(it.productId) ?? {
        productId: it.productId,
        productName: it.productName,
        qty: 0,
        total: 0,
      };
      p.qty += it.qty;
      p.total += it.total;
      productMap.set(it.productId, p);
    }
  }

  return {
    count: sales.length,
    subtotal: addMoney(...sales.map((s) => s.subtotal)),
    discount: addMoney(...sales.map((s) => s.discount)),
    total: addMoney(...sales.map((s) => s.total)),
    paid: addMoney(...sales.map((s) => s.paidAmount)),
    due: addMoney(...sales.map((s) => s.dueAmount)),
    byPaymentMethod: [...methodMap.values()].sort((a, b) => b.total - a.total),
    byProduct: [...productMap.values()].sort((a, b) => b.total - a.total),
    byCustomer: [...customerMap.values()].sort((a, b) => b.total - a.total),
  };
}

export async function getPurchaseReport(start: string, end: string): Promise<PurchaseReportSummary> {
  const purchases = (await db.purchases.where('date').between(start, end, true, true).toArray()).filter(
    (p) => p.status !== 'void',
  );

  const methodMap = new Map<string, PaymentMethodBreakdown>();
  const productMap = new Map<string, ProductBreakdown>();
  const vendorMap = new Map<string, PartyBreakdown>();

  for (const p of purchases) {
    const m = methodMap.get(p.paymentMethod) ?? {
      method: p.paymentMethod,
      count: 0,
      total: 0,
    };
    m.count += 1;
    m.total += p.total;
    methodMap.set(p.paymentMethod, m);

    const v = vendorMap.get(p.vendorId) ?? {
      partyId: p.vendorId,
      partyName: p.vendorName,
      count: 0,
      total: 0,
    };
    v.count += 1;
    v.total += p.total;
    vendorMap.set(p.vendorId, v);

    for (const it of p.items) {
      const prod = productMap.get(it.productId) ?? {
        productId: it.productId,
        productName: it.productName,
        qty: 0,
        total: 0,
      };
      prod.qty += it.qty;
      prod.total += it.total;
      productMap.set(it.productId, prod);
    }
  }

  return {
    count: purchases.length,
    subtotal: addMoney(...purchases.map((p) => p.subtotal)),
    discount: addMoney(...purchases.map((p) => p.discount ?? 0)),
    total: addMoney(...purchases.map((p) => p.total)),
    paid: addMoney(...purchases.map((p) => p.paidAmount)),
    due: addMoney(...purchases.map((p) => p.dueAmount)),
    byPaymentMethod: [...methodMap.values()].sort((a, b) => b.total - a.total),
    byProduct: [...productMap.values()].sort((a, b) => b.total - a.total),
    byVendor: [...vendorMap.values()].sort((a, b) => b.total - a.total),
  };
}

// ─── INVENTORY VALUATION ──────────────────────────────────────

export interface InventoryValuationRow {
  productId: string;
  sku: string;
  name: string;
  category: string;
  stockQty: number;
  costPrice: number; // paise
  sellingPrice: number; // paise
  costValue: number; // paise
  retailValue: number; // paise
  lowStock: boolean;
}

export interface InventoryValuationReport {
  rows: InventoryValuationRow[];
  totalCostValue: number; // paise
  totalRetailValue: number; // paise
  lowStockCount: number;
}

export async function getInventoryValuation(): Promise<InventoryValuationReport> {
  const [products, categories] = await Promise.all([
    activeWhere(db.products).toArray(),
    db.productCategories.toArray(),
  ]);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const rows: InventoryValuationRow[] = products.map((p) => {
    const costValue = multiplyMoney(p.costPrice, p.stockQty);
    const retailValue = multiplyMoney(p.sellingPrice, p.stockQty);
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      category: categoryNames.get(p.category) ?? p.category,
      stockQty: p.stockQty,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      costValue,
      retailValue,
      lowStock: p.stockQty <= p.minStock,
    };
  });

  rows.sort((a, b) => b.costValue - a.costValue);

  return {
    rows,
    totalCostValue: addMoney(...rows.map((r) => r.costValue)),
    totalRetailValue: addMoney(...rows.map((r) => r.retailValue)),
    lowStockCount: rows.filter((r) => r.lowStock).length,
  };
}

export async function getLowStockCount(): Promise<number> {
  return db.products.filter((p) => p.isActive && p.stockQty <= p.minStock).count();
}

// ─── EXPENSE REPORT ───────────────────────────────────────────

export interface ExpenseCategoryRow {
  category: string;
  accountCode: number;
  count: number;
  total: number; // paise
}

export interface ExpenseReportSummary {
  count: number;
  total: number; // paise
  byCategory: ExpenseCategoryRow[];
}

export async function getExpenseReport(start: string, end: string): Promise<ExpenseReportSummary> {
  const expenses = (
    await db.expenses.where('date').between(start, end, true, true).toArray()
  ).filter((e) => !e.voidedAt);
  const catMap = new Map<string, ExpenseCategoryRow>();

  for (const e of expenses) {
    const cur = catMap.get(e.category) ?? {
      category: e.category,
      accountCode: e.accountCode,
      count: 0,
      total: 0,
    };
    cur.count += 1;
    cur.total += e.amount;
    catMap.set(e.category, cur);
  }

  return {
    count: expenses.length,
    total: addMoney(...expenses.map((e) => e.amount)),
    byCategory: [...catMap.values()].sort((a, b) => b.total - a.total),
  };
}

// ─── GROWTH ANALYTICS ─────────────────────────────────────────

export interface CustomerRevenueRow {
  customerId: string;
  customerName: string;
  count: number;
  total: number; // paise
}

export interface SalesMix {
  cashTotal: number; // paise — upfront / fully paid at sale
  creditTotal: number; // paise — credit or partial sales
}

export interface NetWorthPoint {
  month: string;
  key: string;
  netWorth: number; // paise
}

export async function getTopCustomers(limit = 5): Promise<CustomerRevenueRow[]> {
  const sales = await db.sales.filter((s) => s.status !== 'void').toArray();
  const map = new Map<string, CustomerRevenueRow>();

  for (const s of sales) {
    const cid = s.customerId ?? '__walkin__';
    const name = s.customerId ? s.customerName : 'Walk-in / Cash';
    const cur = map.get(cid) ?? { customerId: cid, customerName: name, count: 0, total: 0 };
    cur.count += 1;
    cur.total += s.total;
    map.set(cid, cur);
  }

  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

export async function getSalesMix(): Promise<SalesMix> {
  const sales = await db.sales.filter((s) => s.status !== 'void').toArray();
  let cashTotal = 0;
  let creditTotal = 0;

  for (const s of sales) {
    if (s.paymentMethod === 'credit' || s.status === 'credit' || s.status === 'partial') {
      creditTotal += s.total;
    } else {
      cashTotal += s.total;
    }
  }

  return { cashTotal, creditTotal };
}

export async function getAverageSaleValue(): Promise<number> {
  const sales = await db.sales.filter((s) => s.status !== 'void').toArray();
  if (sales.length === 0) return 0;
  const total = addMoney(...sales.map((s) => s.total));
  return Math.round(total / sales.length);
}

export async function getNetWorthSeries(months = 12): Promise<NetWorthPoint[]> {
  const points: NetWorthPoint[] = [];
  const base = new Date();
  base.setDate(1);

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const monthEnd = new Date(base.getFullYear(), base.getMonth() - i + 1, 0);
    const asOf = monthEnd.toISOString().slice(0, 10);
    const key = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
    const label = monthStart.toLocaleString('en-IN', { month: 'short' });

    const balances = await getAllBalances(asOf);
    let assets = 0;
    let liabilities = 0;
    for (const [code, bal] of balances) {
      if (code >= 100 && code < 200) assets += bal.balance;
      else if (code >= 200 && code < 300) liabilities += bal.balance;
    }

    points.push({ month: label, key, netWorth: subtractMoney(assets, liabilities) });
  }

  return points;
}
