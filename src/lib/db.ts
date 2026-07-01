import Dexie, { type Table } from 'dexie';
import { generateUuid } from '@/lib/utils';

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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
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
  syncedAt?: string;
}

export interface SyncQueueItem {
  id: string; // UUID
  table: string;
  operation: 'create' | 'update' | 'delete';
  recordId: string;
  data: unknown;
  timestamp: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

export interface AppSettings {
  id: 'singleton';
  businessName: string;
  currentFY: string; // "2024-25"
  fyStartMonth: number; // 4 = April
  cashAccountId: string;
  defaultBankId: string;
  currency: 'INR';
  lastSyncAt?: string;
  lastPullAt?: string;
  syncResetToken?: string;
  /** Short random per-device code (e.g. "A3") that makes document numbers collision-proof across devices. */
  deviceId?: string;
  /** Guards one-time data migrations that must not re-run. */
  migrations?: string[];
  saleSequence: number;
  purchaseSequence: number;
  expenseSequence: number;
  /** FY start year the sequence counters currently belong to (for annual reset). */
  sequenceFY?: number;
  seeded: boolean;
}

// ─── DEXIE DB CLASS ───────────────────────────────────────────

class SudoBooksDB extends Dexie {
  accounts!: Table<Account, string>;
  journalEntries!: Table<JournalEntry, string>;
  customers!: Table<Customer, string>;
  vendors!: Table<Vendor, string>;
  products!: Table<Product, string>;
  productCategories!: Table<ProductCategory, string>;
  sales!: Table<Sale, string>;
  purchases!: Table<Purchase, string>;
  expenses!: Table<Expense, string>;
  recurringExpenses!: Table<RecurringExpense, string>;
  bankAccounts!: Table<BankAccount, string>;
  bankTransactions!: Table<BankTransaction, string>;
  stockMovements!: Table<StockMovement, string>;
  syncQueue!: Table<SyncQueueItem, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('SudoBooksDB');
    this.version(1).stores({
      accounts: 'id, code, type, parentCode, isActive',
      journalEntries: 'id, date, entryType, status, linkedId',
      customers: 'id, name, phone, isActive',
      vendors: 'id, name, phone, isActive',
      products: 'id, sku, category, isActive',
      sales: 'id, saleNumber, date, customerId, status',
      purchases: 'id, purchaseNumber, date, vendorId, status',
      expenses: 'id, expenseNumber, date, accountCode',
      bankAccounts: 'id, name, accountId, isActive',
      bankTransactions: 'id, bankAccountId, date, type, linkedId',
      stockMovements: 'id, productId, date, type, linkedId',
      syncQueue: 'id, table, status, timestamp',
      settings: 'id',
    });

    this.version(2).stores({
      accounts: 'id, code, type, parentCode, isActive',
      journalEntries: 'id, date, entryType, status, linkedId',
      customers: 'id, name, phone, isActive',
      vendors: 'id, name, phone, isActive',
      products: 'id, sku, category, isActive',
      sales: 'id, saleNumber, date, customerId, status',
      purchases: 'id, purchaseNumber, date, vendorId, status',
      expenses: 'id, expenseNumber, date, accountCode',
      recurringExpenses: 'id, isActive, dayOfMonth',
      bankAccounts: 'id, name, accountId, isActive',
      bankTransactions: 'id, bankAccountId, date, type, linkedId',
      stockMovements: 'id, productId, date, type, linkedId',
      syncQueue: 'id, table, status, timestamp',
      settings: 'id',
    });

    this.version(3).stores({
      accounts: 'id, code, type, parentCode, isActive',
      journalEntries: 'id, date, entryType, status, linkedId',
      customers: 'id, name, phone, isActive',
      vendors: 'id, name, phone, isActive',
      products: 'id, sku, category, isActive',
      productCategories: 'id, name, isActive',
      sales: 'id, saleNumber, date, customerId, status',
      purchases: 'id, purchaseNumber, date, vendorId, status',
      expenses: 'id, expenseNumber, date, accountCode',
      recurringExpenses: 'id, isActive, dayOfMonth',
      bankAccounts: 'id, name, accountId, isActive',
      bankTransactions: 'id, bankAccountId, date, type, linkedId',
      stockMovements: 'id, productId, date, type, linkedId',
      syncQueue: 'id, table, status, timestamp',
      settings: 'id',
    });
  }
}

export const db = new SudoBooksDB();

/**
 * Multi-tab / multi-device schema-upgrade safety net.
 *
 * If this app is open in more than one tab (or as an installed PWA AND a
 * browser tab at the same time) and one of them loads a newer build with a
 * bumped Dexie version, the OLDER connection blocks the upgrade — and every
 * subsequent read/write on the older tab starts throwing raw IndexedDB
 * errors ("TransactionInactiveError", "DatabaseClosedError", etc). That's
 * confusing and looks like random data-loss risk, so we handle both sides:
 *
 * - The OLDER tab closes its connection the moment a newer one asks to
 *   upgrade, and tells the user to reload instead of silently failing.
 * - The NEWER tab surfaces a warning if it had to wait on a blocked upgrade,
 *   instead of hanging forever with no feedback.
 */
export let dbNeedsReload = false;
const DB_OUTDATED_EVENT = 'sudobooks:db-outdated';

db.on('versionchange', () => {
  dbNeedsReload = true;
  db.close();
  window.dispatchEvent(new CustomEvent(DB_OUTDATED_EVENT));
});

db.on('blocked', () => {
  console.warn('[db] Upgrade blocked by another open tab — waiting for it to close or reload.');
});

export function onDbOutdated(handler: () => void): () => void {
  window.addEventListener(DB_OUTDATED_EVENT, handler);
  return () => window.removeEventListener(DB_OUTDATED_EVENT, handler);
}

/** Current ISO timestamp helper — the ONLY way we generate timestamps. */
export const now = (): string => new Date().toISOString();

/** Generate a UUID primary key. */
export const uuid = (): string => generateUuid();
