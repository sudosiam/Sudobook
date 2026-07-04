import { generateUuid } from '@/lib/utils';
import type { DashboardMetrics, MonthPoint, NetWorthPoint } from '@/lib/reports';
import { SqlTable, runSqlTransaction, type TransactionMode } from '@/lib/sqlite/collection';

type AnySqlTable = SqlTable<{ id: string }>;
import { isDatabaseReady } from '@/lib/sqlite/engine';

// ─── CORE TYPES ───────────────────────────────────────────────

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface Account {
  id: string; // UUID
  code: number; // 101, 201, 401...
  name: string; // "HDFC Bank Current"
  type: AccountType;
  normalBalance: NormalBalance;
  parentCode?: number; // 102 → parent of bank sub-accounts
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  accountId: string;
  accountCode: number;
  debit: number; // paise — 0 if credit entry
  credit: number; // paise — 0 if debit entry
  note?: string;
}
// INVARIANT: sum(lines.debit) === sum(lines.credit)

export type EntryType =
  | 'sale'
  | 'purchase'
  | 'expense'
  | 'payment'
  | 'receipt'
  | 'transfer'
  | 'adjustment'
  | 'opening';

export interface JournalEntry {
  id: string; // UUID — IMMUTABLE after creation
  date: string; // ISO date "2024-03-15"
  reference: string; // "SALE-001", "EXP-045"
  description: string;
  entryType: EntryType;
  status: 'posted' | 'void';
  lines: JournalLine[]; // always length >= 2
  linkedId?: string; // links to sales/purchases/expense record
  reversalOf?: string; // journal entry this reverses (for voids)
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  openingBalance: number; // paise — receivable at start
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  phone: string;
  company?: string;
  address?: string;
  openingBalance: number; // paise — payable at start
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** User-managed product category — replaces the old fixed 5-value enum so the
 * shop owner can add/rename categories freely (e.g. "Helmets", "Chargers"). */
export interface ProductCategory {
  id: string; // UUID (deterministic for defaults, random for user-created)
  name: string; // "E-Scooter"
  skuPrefix: string; // "ESC" — used to auto-generate SKUs for this category
  skuSeq: number; // last auto-generated sequence number for this category
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string; // "ESC-0001" — auto-generated from category prefix, or manual
  name: string;
  category: string; // ProductCategory.id
  unit: string; // "pcs", "set", "kg"
  costPrice: number; // paise — last purchase cost
  sellingPrice: number; // paise — default selling price
  stockQty: number; // integer units
  minStock: number; // low-stock alert threshold
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'cash' | 'bank' | 'upi' | 'partial' | 'credit';
export type DocStatus = 'completed' | 'partial' | 'credit' | 'void';

export interface SaleItem {
  productId: string;
  productName: string;
  qty: number;
  unitPrice: number; // paise
  costPrice: number; // paise — captured at time of sale for COGS
  total: number; // paise = qty * unitPrice
}

export interface Sale {
  id: string;
  saleNumber: string; // "SALE-2024-001"
  date: string;
  customerId?: string;
  customerName: string;
  items: SaleItem[];
  subtotal: number; // paise
  discount: number; // paise
  total: number; // paise
  paidAmount: number; // paise
  dueAmount: number; // paise
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  status: DocStatus;
  notes?: string;
  journalEntryId: string;
  cogsEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number; // paise
  total: number; // paise
}

export interface Purchase {
  id: string;
  purchaseNumber: string; // "PUR-2024-001"
  date: string;
  vendorId: string;
  vendorName: string;
  items: PurchaseItem[];
  subtotal: number; // paise
  discount: number; // paise
  total: number; // paise
  paidAmount: number; // paise
  dueAmount: number; // paise
  paymentMethod: PaymentMethod;
  bankAccountId?: string;
  status: DocStatus;
  notes?: string;
  journalEntryId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  expenseNumber: string; // "EXP-2024-001"
  date: string;
  category: string;
  accountCode: number; // 500-599
  description: string;
  amount: number; // paise
  paidFrom: 'cash' | 'bank';
  bankAccountId?: string;
  receipt?: string;
  journalEntryId: string;
  recurringExpenseId?: string;
  /** Set when the expense has been reversed/voided (its journal entry voided). */
  voidedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpense {
  id: string;
  name: string;
  accountCode: number;
  category: string;
  description: string;
  amount: number; // paise
  paidFrom: 'cash' | 'bank';
  bankAccountId?: string;
  dayOfMonth: number; // 1–28
  isActive: boolean;
  lastPostedMonth?: string; // "2024-07" — last month an expense was generated
  createdAt: string;
  updatedAt: string;
}

export type BankAccountType = 'current' | 'savings' | 'cash';

export interface BankAccount {
  id: string;
  accountId: string; // linked Chart-of-Accounts account id
  name: string; // "HDFC Current A/C"
  bankName: string;
  accountNumber: string;
  accountType: BankAccountType;
  openingBalance: number; // paise
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: string;
  type: 'credit' | 'debit';
  amount: number; // paise
  description: string;
  category: 'sale' | 'purchase' | 'expense' | 'transfer' | 'other';
  reference: string;
  linkedId?: string;
  journalEntryId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  date: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'opening';
  qtyChange: number; // +in / -out
  balanceAfter: number;
  reference: string;
  linkedId?: string;
  note?: string;
  createdAt: string;
  updatedAt: string; // same as createdAt (immutable records)
}

export interface AppSettings {
  id: 'singleton';
  businessName: string;
  currentFY: string; // "2024-25"
  fyStartMonth: number; // 4 = April
  cashAccountId: string;
  defaultBankId: string;
  currency: 'INR';
  /** Guards one-time data migrations that must not re-run. */
  migrations?: string[];
  saleSequence: number;
  purchaseSequence: number;
  expenseSequence: number;
  /** FY start year the sequence counters currently belong to (for annual reset). */
  sequenceFY?: number;
  /** Bumped on every journal post/void — invalidates dashboard cache. */
  dashboardRevision?: number;
  /** Automatic JSON backup — see lib/scheduledBackup.ts */
  autoBackupEnabled?: boolean;
  autoBackupIntervalDays?: 1 | 7 | 30;
  /** ISO timestamp of the last automatic backup run. */
  lastAutoBackupAt?: string;
  /** Download a .json file when an automatic backup runs (default true). */
  autoBackupDownload?: boolean;
  /** Keep rolling snapshots in IndexedDB for quick restore (default true). */
  autoBackupStoreLocal?: boolean;
  /** Save automatic backups to a user-selected folder (File System Access API). */
  autoBackupSaveToFolder?: boolean;
  seeded: boolean;
}

/** Persisted folder handle lives in metaDb — not in the SQLite file. */
export interface BackupFolderRecord {
  id: 'singleton';
  folderName: string;
  handle: FileSystemDirectoryHandle;
}

/** Rolling on-device backup for quick restore (full JSON payload). */
export interface BackupSnapshot {
  id: string;
  createdAt: string;
  label: 'auto' | 'manual';
  file: {
    app: 'sudo-books';
    version: 1 | 2;
    exportedAt: string;
    data: Record<string, unknown[]>;
    checksum?: string;
  };
}

class SudoBooksDB {
  accounts = new SqlTable<Account>('accounts');
  journalEntries = new SqlTable<JournalEntry>('journalEntries');
  customers = new SqlTable<Customer>('customers');
  vendors = new SqlTable<Vendor>('vendors');
  products = new SqlTable<Product>('products');
  productCategories = new SqlTable<ProductCategory>('productCategories');
  sales = new SqlTable<Sale>('sales');
  purchases = new SqlTable<Purchase>('purchases');
  expenses = new SqlTable<Expense>('expenses');
  recurringExpenses = new SqlTable<RecurringExpense>('recurringExpenses');
  bankAccounts = new SqlTable<BankAccount>('bankAccounts');
  bankTransactions = new SqlTable<BankTransaction>('bankTransactions');
  stockMovements = new SqlTable<StockMovement>('stockMovements');
  settings = new SqlTable<AppSettings>('settings');
  backupSnapshots = new SqlTable<BackupSnapshot>('backupSnapshots');
  dashboardCache = new SqlTable<{
    id: string;
    metrics: DashboardMetrics;
    monthlySeries: MonthPoint[];
    netWorthSeries: NetWorthPoint[];
    dashboardRevision: number;
    updatedAt: string;
  }>('dashboardCache');

  /** All business tables (for factory reset / full restore). */
  get tables(): AnySqlTable[] {
    return [
      this.accounts,
      this.journalEntries,
      this.customers,
      this.vendors,
      this.products,
      this.productCategories,
      this.sales,
      this.purchases,
      this.expenses,
      this.recurringExpenses,
      this.bankAccounts,
      this.bankTransactions,
      this.stockMovements,
      this.settings,
      this.backupSnapshots,
      this.dashboardCache,
    ] as unknown as AnySqlTable[];
  }

  table(name: string): AnySqlTable {
    const found = this.tables.find((t) => t.name === name);
    if (!found) throw new Error(`Unknown table: ${name}`);
    return found;
  }

  transaction<T>(mode: TransactionMode, ...rest: unknown[]): Promise<T> {
    const fn = rest[rest.length - 1];
    if (typeof fn !== 'function') {
      throw new Error('db.transaction requires a callback as the last argument');
    }
    const tables = rest.slice(0, -1);
    return runSqlTransaction(mode, tables, fn as () => T | Promise<T>);
  }
}

export const db = new SudoBooksDB();

/** @deprecated SQLite file is the source of truth — kept for callers that still check. */
export let dbNeedsReload = false;

export function onDbOutdated(handler: () => void): () => void {
  void handler;
  return () => undefined;
}

export function isDbOutdated(): boolean {
  return false;
}

export function assertDbWritable(): void {
  if (!isDatabaseReady()) {
    throw new Error('Database not ready — choose a data folder first');
  }
}

/**
 * Active rows only. Uses `.filter()` because boolean `true` in IndexedDB does not
 * match Dexie `.equals(1)` — see comment above.
 */
export function activeWhere<T extends { id: string; isActive: boolean }>(table: SqlTable<T>) {
  return table.filter((row) => row.isActive);
}

/** Current ISO timestamp helper — the ONLY way we generate timestamps. */
export const now = (): string => new Date().toISOString();

/** Generate a UUID primary key. */
export const uuid = (): string => generateUuid();
