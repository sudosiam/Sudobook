import {
  db,
  assertDbWritable,
  now,
  uuid,
  type BankAccount,
  type BankTransaction,
  type Expense,
  type JournalLine,
  type Product,
  type Purchase,
  type PurchaseItem,
  type Sale,
  type SaleItem,
  type StockMovement,
} from '@/lib/db';
import { CODES } from '@/lib/coa';
import { postJournalEntryTx, voidJournalEntryTx } from '@/lib/accounting';
import { addMoney, multiplyMoney, reverseWeightedAverageCost, subtractMoney, weightedAverageCost } from '@/lib/money';
import {
  assertExpenseAccountCode,
  assertIncomeAccountCode,
  assertIsoDate,
  assertPositivePaise,
  resolveExpensePaymentBank,
} from '@/lib/runtimeValidation';
import { effectivePurchaseUnitCost } from '@/lib/purchases';
import { nextDocumentNumberTx } from '@/lib/sequences';

/** Map every account code → its UUID (chart of accounts is small, cached in-memory). */
let cachedCodeMap: Map<number, string> | null = null;

export function invalidateCodeToIdMap(): void {
  cachedCodeMap = null;
}

async function codeToIdMap(): Promise<Map<number, string>> {
  if (cachedCodeMap) return cachedCodeMap;
  let accounts = await db.accounts.toArray();
  if (accounts.length === 0) {
    const { ensureDefaultAccounts } = await import('@/lib/seed');
    await ensureDefaultAccounts();
    accounts = await db.accounts.toArray();
  }
  const map = new Map<number, string>();
  for (const a of accounts) map.set(a.code, a.id);
  if (map.size === 0) {
    throw new Error('Chart of accounts is missing — reload the app or restore from backup.');
  }
  cachedCodeMap = map;
  return map;
}

function line(
  map: Map<number, string>,
  code: number,
  debit: number,
  credit: number,
  note?: string,
): JournalLine {
  const accountId = map.get(code);
  if (!accountId) throw new Error(`Account ${code} missing from chart of accounts`);
  return { accountId, accountCode: code, debit, credit, note };
}

/** COA posting code for a bank/cash account. */
function bankCode(bank: BankAccount): number {
  return bank.accountType === 'cash' ? CODES.CASH : CODES.BANK;
}

async function recordBankTxn(
  bank: BankAccount,
  type: 'credit' | 'debit',
  amount: number,
  data: {
    date: string;
    description: string;
    category: BankTransaction['category'];
    reference: string;
    linkedId?: string;
    journalEntryId?: string;
  },
): Promise<void> {
  const txn: BankTransaction = {
    id: uuid(),
    bankAccountId: bank.id,
    type,
    amount,
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.bankTransactions.add(txn);
}

async function recordStockMovement(
  productId: string,
  type: StockMovement['type'],
  qtyChange: number,
  data: { date: string; reference: string; linkedId?: string; note?: string },
): Promise<number> {
  const product = await db.products.get(productId);
  if (!product) throw new Error('Product not found');
  const balanceAfter = product.stockQty + qtyChange;
  const mv: StockMovement = {
    id: uuid(),
    productId: product.id,
    productName: product.name,
    type,
    qtyChange,
    balanceAfter,
    ...data,
    createdAt: now(),
  };
  await db.stockMovements.add(mv);
  return balanceAfter;
}

/** Persist a product change and queue it for cloud sync (inventory must sync). */
async function updateProductStock(
  id: string,
  patch: Partial<Product>,
): Promise<void> {
  await db.products.update(id, { ...patch, updatedAt: now() });
}

/** Reverse every bank transaction linked to a document (skips prior reversals). */
async function reverseBankTxnsFor(linkedId: string): Promise<void> {
  const txns = await db.bankTransactions.where('linkedId').equals(linkedId).toArray();
  for (const t of txns) {
    if (t.reference.startsWith('VOID-')) continue;
    const bank = await db.bankAccounts.get(t.bankAccountId);
    if (!bank) continue;
    await recordBankTxn(bank, t.type === 'credit' ? 'debit' : 'credit', t.amount, {
      date: now().slice(0, 10),
      description: `Void ${t.description}`,
      category: t.category,
      reference: `VOID-${t.reference}`,
      linkedId,
    });
  }
}

/** Void every posted journal entry tied to a document (main, COGS, payments). */
async function voidLinkedJournalEntries(
  linkedId: string,
  extraIds: (string | undefined)[],
  reason: string,
): Promise<void> {
  const jeIds = new Set<string>();
  for (const id of extraIds) if (id) jeIds.add(id);

  const linkedTxns = await db.bankTransactions.where('linkedId').equals(linkedId).toArray();
  for (const t of linkedTxns) if (t.journalEntryId) jeIds.add(t.journalEntryId);

  const linkedJEs = await db.journalEntries.where('linkedId').equals(linkedId).toArray();
  for (const je of linkedJEs) jeIds.add(je.id);

  for (const id of jeIds) {
    const je = await db.journalEntries.get(id);
    if (je && je.status === 'posted') await voidJournalEntryTx(id, reason);
  }
}

// ─── SALES ────────────────────────────────────────────────────

export interface RecordSaleInput {
  date: string;
  customerId?: string;
  customerName: string;
  items: SaleItem[];
  discount: number; // paise
  paymentMethod: Sale['paymentMethod'];
  bankAccountId?: string;
  paidAmount: number; // paise
  notes?: string;
}

export async function recordSale(input: RecordSaleInput): Promise<string> {
  assertDbWritable();
  assertIsoDate(input.date);
  const lineItems = input.items.map((item) => ({ ...item }));
  const subtotal = addMoney(...lineItems.map((i) => i.total));
  const total = Math.max(subtractMoney(subtotal, input.discount), 0);
  if (total < 0) throw new Error('Sale total cannot be negative');
  const paidAmount = Math.min(input.paidAmount, total);
  const dueAmount = subtractMoney(total, paidAmount);

  const map = await codeToIdMap();
  const saleId = uuid();

  let bank: BankAccount | undefined;
  if (paidAmount > 0) {
    const bankId = input.bankAccountId ?? (await defaultCashBankId());
    bank = await db.bankAccounts.get(bankId);
    if (!bank) throw new Error('Payment account not found');
  }

  await db.transaction(
    'rw',
    [db.sales, db.products, db.stockMovements, db.bankTransactions, db.journalEntries, db.settings],
    async () => {
      const saleNumber = await nextDocumentNumberTx('saleSequence', 'SALE', input.date);

      // Resolve products inside the transaction to prevent overselling on concurrent sales.
      const qtyByProduct = new Map<string, number>();
      for (const item of lineItems) {
        qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
      }

      const items: SaleItem[] = [];
      let cogs = 0;
      for (const item of lineItems) {
        const product = await db.products.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productName}`);
        const needed = qtyByProduct.get(item.productId) ?? item.qty;
        if (product.stockQty < needed) {
          throw new Error(
            `Insufficient stock for ${product.name} (have ${product.stockQty}, need ${needed})`,
          );
        }
        const unitCost = product.costPrice;
        cogs += multiplyMoney(unitCost, item.qty);
        items.push({ ...item, costPrice: unitCost });
      }

      const revenueLines: JournalLine[] = [];
      if (total === 0) {
        revenueLines.push(line(map, CODES.PRODUCT_SALES, 0, 0, 'Free sale'));
        revenueLines.push(line(map, CODES.RECEIVABLE, 0, 0, 'No charge'));
      } else {
        if (paidAmount > 0 && bank) {
          revenueLines.push(line(map, bankCode(bank), paidAmount, 0, 'Cash/Bank received'));
        }
        if (dueAmount > 0) {
          revenueLines.push(line(map, CODES.RECEIVABLE, dueAmount, 0, 'On credit'));
        }
        revenueLines.push(line(map, CODES.PRODUCT_SALES, 0, total, 'Product sales'));
      }

      const status: Sale['status'] =
        dueAmount === 0 ? 'completed' : paidAmount > 0 ? 'partial' : 'credit';

      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference: saleNumber,
        description: `Sale ${saleNumber} — ${input.customerName}`,
        entryType: 'sale',
        linkedId: saleId,
        lines: revenueLines,
      });

      let cogsEntryId: string | undefined;
      if (cogs > 0) {
        cogsEntryId = await postJournalEntryTx({
          date: input.date,
          reference: saleNumber,
          description: `COGS for ${saleNumber}`,
          entryType: 'sale',
          linkedId: saleId,
          lines: [
            line(map, CODES.COGS, cogs, 0, 'Cost of goods sold'),
            line(map, CODES.INVENTORY, 0, cogs, 'Inventory reduction'),
          ],
        });
      }

      const sale: Sale = {
        id: saleId,
        saleNumber,
        date: input.date,
        customerId: input.customerId,
        customerName: input.customerName,
        items,
        subtotal,
        discount: input.discount,
        total,
        paidAmount,
        dueAmount,
        paymentMethod: input.paymentMethod,
        bankAccountId: bank?.id,
        status,
        notes: input.notes,
        journalEntryId,
        cogsEntryId,
        createdAt: now(),
        updatedAt: now(),
      };

      await db.sales.add(sale);

      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productName}`);
        const needed = qtyByProduct.get(item.productId) ?? item.qty;
        if (product.stockQty < needed) {
          throw new Error(
            `Insufficient stock for ${product.name} (have ${product.stockQty}, need ${needed})`,
          );
        }
        const balanceAfter = await recordStockMovement(product.id, 'sale', -item.qty, {
          date: input.date,
          reference: saleNumber,
          linkedId: saleId,
        });
        await updateProductStock(product.id, { stockQty: balanceAfter });
      }

      if (paidAmount > 0 && bank) {
        await recordBankTxn(bank, 'credit', paidAmount, {
          date: input.date,
          description: `Sale ${saleNumber}`,
          category: 'sale',
          reference: saleNumber,
          linkedId: saleId,
          journalEntryId,
        });
      }
    },
  );
  return saleId;
}

export async function voidSale(saleId: string, reason: string): Promise<void> {
  assertDbWritable();
  const sale = await db.sales.get(saleId);
  if (!sale) throw new Error('Sale not found');
  if (sale.status === 'void') throw new Error('Sale already voided');

  await db.transaction(
    'rw',
    [db.sales, db.products, db.stockMovements, db.bankAccounts, db.bankTransactions, db.journalEntries],
    async () => {
      await voidLinkedJournalEntries(saleId, [sale.journalEntryId, sale.cogsEntryId], reason);

      // Restore stock qty only. COGS/inventory GL is reversed by voided journal entries;
      // re-blending WAC here corrupts cost when stock was replenished after the sale.
      for (const item of sale.items) {
        const product = await db.products.get(item.productId);
        if (!product) {
          console.warn(`[voidSale] product ${item.productId} (${item.productName}) not found — stock not restored, GL already reversed`);
          continue;
        }
        const balanceAfter = await recordStockMovement(product.id, 'adjustment', item.qty, {
          date: now().slice(0, 10),
          reference: `VOID-${sale.saleNumber}`,
          linkedId: saleId,
          note: 'Sale voided — stock restored',
        });
        await updateProductStock(product.id, { stockQty: balanceAfter });
      }

      // Reverse every bank movement (initial receipt + later payments).
      await reverseBankTxnsFor(saleId);

      await db.sales.update(saleId, { status: 'void', updatedAt: now() });
    },
  );
}

/** Receive a payment against a credit/partial sale (customer receivable). */
export async function receiveSalePayment(
  saleId: string,
  input: { date: string; amount: number; method: 'cash' | 'bank' | 'upi'; bankAccountId?: string },
): Promise<void> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);
  if ((input.method === 'bank' || input.method === 'upi') && !input.bankAccountId) {
    throw new Error('Bank account required');
  }

  const map = await codeToIdMap();
  const bankId = input.bankAccountId ?? (await defaultCashBankId());
  const bank = await db.bankAccounts.get(bankId);
  if (!bank?.isActive) throw new Error('Payment account not found');

  await db.transaction(
    'rw',
    [db.sales, db.bankTransactions, db.journalEntries],
    async () => {
      // Re-read inside the transaction to avoid double-payment races.
      const sale = await db.sales.get(saleId);
      if (!sale) throw new Error('Sale not found');
      if (sale.status === 'void') throw new Error('Sale is void');
      if (input.amount > sale.dueAmount) {
        throw new Error('Amount exceeds outstanding balance');
      }
      const amount = input.amount;
      if (amount <= 0) throw new Error('Nothing due');

      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference: sale.saleNumber,
        description: `Payment received — ${sale.saleNumber}`,
        entryType: 'receipt',
        linkedId: saleId,
        lines: [
          line(map, bankCode(bank), amount, 0, 'Payment received'),
          line(map, CODES.RECEIVABLE, 0, amount, 'Receivable settled'),
        ],
      });

      await recordBankTxn(bank, 'credit', amount, {
        date: input.date,
        description: `Payment ${sale.saleNumber}`,
        category: 'sale',
        reference: sale.saleNumber,
        linkedId: saleId,
        journalEntryId,
      });

      const paidAmount = sale.paidAmount + amount;
      const dueAmount = subtractMoney(sale.total, paidAmount);
      await db.sales.update(saleId, {
        paidAmount,
        dueAmount,
        status: dueAmount === 0 ? 'completed' : 'partial',
        updatedAt: now(),
      });
    },
  );
}

// ─── PURCHASES ────────────────────────────────────────────────

export interface RecordPurchaseInput {
  date: string;
  vendorId: string;
  vendorName: string;
  items: PurchaseItem[];
  discount: number; // paise
  paymentMethod: Purchase['paymentMethod'];
  bankAccountId?: string;
  paidAmount: number;
  notes?: string;
}

export async function recordPurchase(input: RecordPurchaseInput): Promise<string> {
  assertDbWritable();
  assertIsoDate(input.date);
  if (input.items.length === 0) throw new Error('At least one item required');
  const subtotal = addMoney(...input.items.map((i) => i.total));
  const total = Math.max(subtractMoney(subtotal, input.discount), 0);
  if (subtotal <= 0) throw new Error('Purchase total must be greater than zero');
  const paidAmount = Math.min(input.paidAmount, total);
  const dueAmount = subtractMoney(total, paidAmount);

  const map = await codeToIdMap();
  const purchaseId = uuid();

  let bank: BankAccount | undefined;
  if (paidAmount > 0) {
    const bankId = input.bankAccountId ?? (await defaultCashBankId());
    bank = await db.bankAccounts.get(bankId);
    if (!bank) throw new Error('Payment account not found');
  }

  const lines: JournalLine[] = [];
  if (total === 0) {
    lines.push(line(map, CODES.INVENTORY, 0, 0, 'Inventory received (no charge)'));
    lines.push(line(map, CODES.PAYABLE, 0, 0, 'Vendor discount'));
  } else {
    lines.push(line(map, CODES.INVENTORY, total, 0, 'Inventory received'));
    if (paidAmount > 0 && bank) {
      lines.push(line(map, bankCode(bank), 0, paidAmount, 'Cash/Bank paid'));
    }
    if (dueAmount > 0) {
      lines.push(line(map, CODES.PAYABLE, 0, dueAmount, 'On credit'));
    }
  }

  const status: Purchase['status'] =
    dueAmount === 0 ? 'completed' : paidAmount > 0 ? 'partial' : 'credit';

  await db.transaction(
    'rw',
    [db.purchases, db.products, db.stockMovements, db.bankTransactions, db.journalEntries, db.settings],
    async () => {
      const purchaseNumber = await nextDocumentNumberTx('purchaseSequence', 'PUR', input.date);
      for (const item of input.items) {
        const product = await db.products.get(item.productId);
        if (!product?.isActive) {
          throw new Error(`Product not found: ${item.productName}`);
        }
      }

      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference: purchaseNumber,
        description: `Purchase ${purchaseNumber} — ${input.vendorName}`,
        entryType: 'purchase',
        linkedId: purchaseId,
        lines,
      });

      const purchase: Purchase = {
        id: purchaseId,
        purchaseNumber,
        date: input.date,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        items: input.items,
        subtotal,
        discount: input.discount,
        total,
        paidAmount,
        dueAmount,
        paymentMethod: input.paymentMethod,
        bankAccountId: bank?.id,
        status,
        notes: input.notes,
        journalEntryId,
        createdAt: now(),
        updatedAt: now(),
      };

      await db.purchases.add(purchase);

      for (const item of input.items) {
        const product = (await db.products.get(item.productId))!;
        const balanceAfter = await recordStockMovement(product.id, 'purchase', item.qty, {
            date: input.date,
            reference: purchaseNumber,
            linkedId: purchaseId,
          });
          // Weighted-average cost keeps GL Inventory (104) reconciled with the
          // per-unit cost used for COGS on future sales.
          const newCost = weightedAverageCost(
            product.stockQty,
            product.costPrice,
            item.qty,
            effectivePurchaseUnitCost(item, subtotal, total),
          );
          await updateProductStock(product.id, { stockQty: balanceAfter, costPrice: newCost });
      }

      if (paidAmount > 0 && bank) {
        await recordBankTxn(bank, 'debit', paidAmount, {
          date: input.date,
          description: `Purchase ${purchaseNumber}`,
          category: 'purchase',
          reference: purchaseNumber,
          linkedId: purchaseId,
          journalEntryId,
        });
      }
    },
  );
  return purchaseId;
}

/** Pay a vendor against a credit/partial purchase (payable). */
export async function payPurchase(
  purchaseId: string,
  input: { date: string; amount: number; method: 'cash' | 'bank' | 'upi'; bankAccountId?: string },
): Promise<void> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);
  if ((input.method === 'bank' || input.method === 'upi') && !input.bankAccountId) {
    throw new Error('Bank account required');
  }

  const map = await codeToIdMap();
  const bankId = input.bankAccountId ?? (await defaultCashBankId());
  const bank = await db.bankAccounts.get(bankId);
  if (!bank?.isActive) throw new Error('Payment account not found');

  await db.transaction(
    'rw',
    [db.purchases, db.bankTransactions, db.journalEntries],
    async () => {
      const purchase = await db.purchases.get(purchaseId);
      if (!purchase) throw new Error('Purchase not found');
      if (purchase.status === 'void') throw new Error('Purchase is void');
      if (input.amount > purchase.dueAmount) {
        throw new Error('Amount exceeds outstanding balance');
      }
      const amount = input.amount;
      if (amount <= 0) throw new Error('Nothing payable');

      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference: purchase.purchaseNumber,
        description: `Vendor payment — ${purchase.purchaseNumber}`,
        entryType: 'payment',
        linkedId: purchaseId,
        lines: [
          line(map, CODES.PAYABLE, amount, 0, 'Payable settled'),
          line(map, bankCode(bank), 0, amount, 'Payment made'),
        ],
      });

      await recordBankTxn(bank, 'debit', amount, {
        date: input.date,
        description: `Payment ${purchase.purchaseNumber}`,
        category: 'purchase',
        reference: purchase.purchaseNumber,
        linkedId: purchaseId,
        journalEntryId,
      });

      const paidAmount = purchase.paidAmount + amount;
      const dueAmount = subtractMoney(purchase.total, paidAmount);
      await db.purchases.update(purchaseId, {
        paidAmount,
        dueAmount,
        status: dueAmount === 0 ? 'completed' : 'partial',
        updatedAt: now(),
      });
    },
  );
}

export async function voidPurchase(purchaseId: string, reason: string): Promise<void> {
  assertDbWritable();
  const purchase = await db.purchases.get(purchaseId);
  if (!purchase) throw new Error('Purchase not found');
  if (purchase.status === 'void') throw new Error('Purchase already voided');

  await db.transaction(
    'rw',
    [db.purchases, db.products, db.stockMovements, db.bankAccounts, db.bankTransactions, db.journalEntries],
    async () => {
      await voidLinkedJournalEntries(purchaseId, [purchase.journalEntryId], reason);

      for (const item of purchase.items) {
        const product = await db.products.get(item.productId);
        if (!product) {
          console.warn(`[voidPurchase] product ${item.productId} (${item.productName}) not found — stock not removed, GL already reversed`);
          continue;
        }
        if (product.stockQty < item.qty) {
          throw new Error(
            `Cannot void purchase: insufficient stock for ${product.name} (have ${product.stockQty}, need ${item.qty})`,
          );
        }
        const balanceAfter = await recordStockMovement(product.id, 'adjustment', -item.qty, {
          date: now().slice(0, 10),
          reference: `VOID-${purchase.purchaseNumber}`,
          linkedId: purchaseId,
          note: 'Purchase voided — stock removed',
        });
        const stockPatch: { stockQty: number; costPrice?: number } = { stockQty: balanceAfter };
        if (product.stockQty >= item.qty) {
          const unitCost = effectivePurchaseUnitCost(
            item,
            purchase.subtotal,
            purchase.total,
          );
          stockPatch.costPrice = reverseWeightedAverageCost(
            product.stockQty,
            product.costPrice,
            item.qty,
            unitCost,
          );
        }
        await updateProductStock(product.id, stockPatch);
      }

      await reverseBankTxnsFor(purchaseId);

      await db.purchases.update(purchaseId, { status: 'void', updatedAt: now() });
    },
  );
}

// ─── EXPENSES ─────────────────────────────────────────────────

export interface RecordExpenseInput {
  date: string;
  accountCode: number;
  category: string;
  description: string;
  amount: number;
  paidFrom: 'cash' | 'bank';
  bankAccountId?: string;
  recurringExpenseId?: string;
}

export async function recordExpense(input: RecordExpenseInput): Promise<string> {
  assertDbWritable();
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);
  assertExpenseAccountCode(input.accountCode);

  const map = await codeToIdMap();
  const expenseId = uuid();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction(
    'rw',
    [db.expenses, db.bankTransactions, db.journalEntries, db.settings],
    async () => {
      if (input.recurringExpenseId) {
        const monthPrefix = input.date.slice(0, 7);
        const duplicate = await db.expenses
          .filter(
            (e) =>
              e.recurringExpenseId === input.recurringExpenseId &&
              !e.voidedAt &&
              e.date.startsWith(monthPrefix),
          )
          .first();
        if (duplicate) {
          throw new Error('Recurring expense already posted for this month');
        }
      }

      const expenseNumber = await nextDocumentNumberTx('expenseSequence', 'EXP', input.date);

      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference: expenseNumber,
        description: `${input.category}: ${input.description}`,
        entryType: 'expense',
        linkedId: expenseId,
        lines: [
          line(map, input.accountCode, input.amount, 0, input.category),
          line(map, bankCode(bank), 0, input.amount, 'Paid'),
        ],
      });

      const expense: Expense = {
        id: expenseId,
        expenseNumber,
        date: input.date,
        category: input.category,
        accountCode: input.accountCode,
        description: input.description,
        amount: input.amount,
        paidFrom: input.paidFrom,
        bankAccountId: bank.id,
        journalEntryId,
        recurringExpenseId: input.recurringExpenseId,
        voidedAt: null,
        createdAt: now(),
        updatedAt: now(),
      };

      await db.expenses.add(expense);
      await recordBankTxn(bank, 'debit', input.amount, {
        date: input.date,
        description: `${input.category}: ${input.description}`,
        category: 'expense',
        reference: expenseNumber,
        linkedId: expenseId,
        journalEntryId,
      });
    },
  );
  return expenseId;
}

export async function voidExpense(expenseId: string, reason: string): Promise<void> {
  const expense = await db.expenses.get(expenseId);
  if (!expense) throw new Error('Expense not found');
  if (expense.voidedAt) throw new Error('Expense already voided');

  await db.transaction(
    'rw',
    [db.expenses, db.bankAccounts, db.bankTransactions, db.journalEntries],
    async () => {
      await voidLinkedJournalEntries(expenseId, [expense.journalEntryId], reason);
      await reverseBankTxnsFor(expenseId);
      await db.expenses.update(expenseId, { voidedAt: now(), updatedAt: now() });
    },
  );
}

// ─── BANKING ──────────────────────────────────────────────────

export async function transferBetweenBanks(input: {
  date: string;
  fromBankId: string;
  toBankId: string;
  amount: number;
  note?: string;
}): Promise<void> {
  assertDbWritable();
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  if (input.fromBankId === input.toBankId) {
    throw new Error('Source and destination must be different accounts');
  }

  const from = await db.bankAccounts.get(input.fromBankId);
  const to = await db.bankAccounts.get(input.toBankId);
  if (!from || !to) throw new Error('Bank account not found');

  const map = await codeToIdMap();
  const reference = `TRF-${uuid().slice(0, 8)}`;

  await db.transaction(
    'rw',
    [db.bankTransactions, db.journalEntries],
    async () => {
      // Always post a balanced journal entry (even when both banks share COA 102 — nets to zero).
      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference,
        description: input.note ?? `Transfer ${from.name} → ${to.name}`,
        entryType: 'transfer',
        lines: [
          line(map, bankCode(to), input.amount, 0, `To ${to.name}`),
          line(map, bankCode(from), 0, input.amount, `From ${from.name}`),
        ],
      });

      await recordBankTxn(from, 'debit', input.amount, {
        date: input.date,
        description: input.note ?? `Transfer to ${to.name}`,
        category: 'transfer',
        reference,
        journalEntryId,
      });
      await recordBankTxn(to, 'credit', input.amount, {
        date: input.date,
        description: input.note ?? `Transfer from ${from.name}`,
        category: 'transfer',
        reference,
        journalEntryId,
      });
    },
  );
}

const ADJUSTMENT_STORES = [db.bankTransactions, db.journalEntries] as const;

type AdjustmentPaymentInput = {
  date: string;
  description: string;
  amount: number; // paise
  paidFrom: 'cash' | 'bank';
  bankAccountId?: string;
};

/** Void adjustment inside an existing Dexie transaction (no sync). */
async function voidAdjustmentRecordTx(linkedId: string, reason: string): Promise<void> {
  await reverseBankTxnsFor(linkedId);
  await voidLinkedJournalEntries(linkedId, [], reason);
}

/** Atomically void an adjustment and post its replacement — rolls back if repost fails. */
async function replaceAdjustmentRecord(
  linkedId: string,
  reason: string,
  repost: (newLinkedId: string) => Promise<void>,
): Promise<string> {
  assertDbWritable();
  if (!linkedId) throw new Error('Missing record id');
  const newLinkedId = uuid();
  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await voidAdjustmentRecordTx(linkedId, reason);
    await repost(newLinkedId);
  });
  return newLinkedId;
}

async function postFixedAssetPurchaseTx(
  input: AdjustmentPaymentInput,
  linkedId: string,
  map: Map<number, string>,
  bank: BankAccount,
): Promise<void> {
  const reference = `FA-${uuid().slice(0, 8).toUpperCase()}`;
  const journalEntryId = await postJournalEntryTx({
    date: input.date,
    reference,
    description: `Fixed asset: ${input.description}`,
    entryType: 'adjustment',
    linkedId,
    lines: [
      line(map, CODES.FIXED_ASSETS, input.amount, 0, input.description),
      line(map, bankCode(bank), 0, input.amount, 'Paid'),
    ],
  });
  await recordBankTxn(bank, 'debit', input.amount, {
    date: input.date,
    description: `Fixed asset: ${input.description}`,
    category: 'other',
    reference,
    linkedId,
    journalEntryId,
  });
}

async function postLoanReceivedTx(
  input: AdjustmentPaymentInput,
  linkedId: string,
  map: Map<number, string>,
  bank: BankAccount,
): Promise<void> {
  const reference = `LN-${uuid().slice(0, 8).toUpperCase()}`;
  const journalEntryId = await postJournalEntryTx({
    date: input.date,
    reference,
    description: `Loan received: ${input.description}`,
    entryType: 'adjustment',
    linkedId,
    lines: [
      line(map, bankCode(bank), input.amount, 0, 'Proceeds'),
      line(map, CODES.LOANS, 0, input.amount, input.description),
    ],
  });
  await recordBankTxn(bank, 'credit', input.amount, {
    date: input.date,
    description: `Loan received: ${input.description}`,
    category: 'other',
    reference,
    linkedId,
    journalEntryId,
  });
}

async function postLoanRepaymentTx(
  input: AdjustmentPaymentInput,
  linkedId: string,
  map: Map<number, string>,
  bank: BankAccount,
): Promise<void> {
  const reference = `LN-${uuid().slice(0, 8).toUpperCase()}`;
  const journalEntryId = await postJournalEntryTx({
    date: input.date,
    reference,
    description: `Loan repayment: ${input.description}`,
    entryType: 'adjustment',
    linkedId,
    lines: [
      line(map, CODES.LOANS, input.amount, 0, input.description),
      line(map, bankCode(bank), 0, input.amount, 'Paid'),
    ],
  });
  await recordBankTxn(bank, 'debit', input.amount, {
    date: input.date,
    description: `Loan repayment: ${input.description}`,
    category: 'other',
    reference,
    linkedId,
    journalEntryId,
  });
}

async function postOwnerContributionTx(
  input: AdjustmentPaymentInput,
  linkedId: string,
  map: Map<number, string>,
  bank: BankAccount,
): Promise<void> {
  const reference = `EQ-${uuid().slice(0, 8).toUpperCase()}`;
  const journalEntryId = await postJournalEntryTx({
    date: input.date,
    reference,
    description: `Owner contribution: ${input.description}`,
    entryType: 'adjustment',
    linkedId,
    lines: [
      line(map, bankCode(bank), input.amount, 0, 'Contribution'),
      line(map, CODES.CAPITAL, 0, input.amount, input.description),
    ],
  });
  await recordBankTxn(bank, 'credit', input.amount, {
    date: input.date,
    description: `Owner contribution: ${input.description}`,
    category: 'other',
    reference,
    linkedId,
    journalEntryId,
  });
}

async function postOwnerDrawTx(
  input: AdjustmentPaymentInput,
  linkedId: string,
  map: Map<number, string>,
  bank: BankAccount,
): Promise<void> {
  const reference = `EQ-${uuid().slice(0, 8).toUpperCase()}`;
  const journalEntryId = await postJournalEntryTx({
    date: input.date,
    reference,
    description: `Owner draw: ${input.description}`,
    entryType: 'adjustment',
    linkedId,
    lines: [
      line(map, CODES.CAPITAL, input.amount, 0, input.description),
      line(map, bankCode(bank), 0, input.amount, 'Withdrawn'),
    ],
  });
  await recordBankTxn(bank, 'debit', input.amount, {
    date: input.date,
    description: `Owner draw: ${input.description}`,
    category: 'other',
    reference,
    linkedId,
    journalEntryId,
  });
}

async function postCreditCardPaymentTx(
  input: AdjustmentPaymentInput,
  linkedId: string,
  map: Map<number, string>,
  bank: BankAccount,
): Promise<void> {
  const reference = `CC-${uuid().slice(0, 8).toUpperCase()}`;
  const journalEntryId = await postJournalEntryTx({
    date: input.date,
    reference,
    description: `Credit card payment: ${input.description}`,
    entryType: 'adjustment',
    linkedId,
    lines: [
      line(map, CODES.CREDIT_CARDS, input.amount, 0, input.description),
      line(map, bankCode(bank), 0, input.amount, 'Paid'),
    ],
  });
  await recordBankTxn(bank, 'debit', input.amount, {
    date: input.date,
    description: `Credit card payment: ${input.description}`,
    category: 'other',
    reference,
    linkedId,
    journalEntryId,
  });
}

async function postCreditCardChargeTx(
  input: { date: string; description: string; amount: number; accountCode: number },
  linkedId: string,
  map: Map<number, string>,
): Promise<void> {
  const reference = `CC-${uuid().slice(0, 8).toUpperCase()}`;
  await postJournalEntryTx({
    date: input.date,
    reference,
    description: `Credit card: ${input.description}`,
    entryType: 'expense',
    linkedId,
    lines: [
      line(map, input.accountCode, input.amount, 0, input.description),
      line(map, CODES.CREDIT_CARDS, 0, input.amount, 'On card'),
    ],
  });
}

/** Capital expenditure — debits Fixed Assets (105), credits cash/bank. */
export async function recordFixedAssetPurchase(input: AdjustmentPaymentInput): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  const map = await codeToIdMap();
  const linkedId = uuid();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await postFixedAssetPurchaseTx(input, linkedId, map, bank);
  });

  return linkedId;
}

/** Borrow funds — debits cash/bank, credits Loans (202). */
export async function recordLoanReceived(input: AdjustmentPaymentInput): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  const map = await codeToIdMap();
  const linkedId = uuid();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await postLoanReceivedTx(input, linkedId, map, bank);
  });

  return linkedId;
}

/** Repay loan principal — debits Loans (202), credits cash/bank. */
export async function recordLoanRepayment(input: AdjustmentPaymentInput): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  const map = await codeToIdMap();
  const linkedId = uuid();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await postLoanRepaymentTx(input, linkedId, map, bank);
  });

  return linkedId;
}

/** Owner puts money into the business — debits cash/bank, credits Owner's Capital (301). */
export async function recordOwnerContribution(input: AdjustmentPaymentInput): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  const map = await codeToIdMap();
  const linkedId = uuid();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await postOwnerContributionTx(input, linkedId, map, bank);
  });

  return linkedId;
}

/** Owner withdrawal — debits Owner's Capital (301), credits cash/bank. */
export async function recordOwnerDraw(input: AdjustmentPaymentInput): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  const map = await codeToIdMap();
  const linkedId = uuid();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await postOwnerDrawTx(input, linkedId, map, bank);
  });

  return linkedId;
}

/** Pay credit card bill — debits Credit Cards (203), credits cash/bank. */
export async function recordCreditCardPayment(input: AdjustmentPaymentInput): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  const map = await codeToIdMap();
  const linkedId = uuid();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await postCreditCardPaymentTx(input, linkedId, map, bank);
  });

  return linkedId;
}

/** Expense on credit card — debits expense account, credits Credit Cards (203). No cash movement. */
export async function recordCreditCardCharge(input: {
  date: string;
  description: string;
  amount: number; // paise
  accountCode: number;
}): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);
  assertExpenseAccountCode(input.accountCode);

  const map = await codeToIdMap();
  const linkedId = uuid();

  await db.transaction('rw', [db.journalEntries], async () => {
    await postCreditCardChargeTx(input, linkedId, map);
  });

  return linkedId;
}

/** Void a capital/liability adjustment and reverse any linked bank movements. */
export async function voidAdjustmentRecord(linkedId: string, reason = 'Removed'): Promise<void> {
  assertDbWritable();
  if (!linkedId) throw new Error('Missing record id');
  await db.transaction('rw', [...ADJUSTMENT_STORES], async () => {
    await voidAdjustmentRecordTx(linkedId, reason);
  });
}

export async function updateFixedAssetPurchase(
  linkedId: string,
  input: AdjustmentPaymentInput,
): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);
  const map = await codeToIdMap();
  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );
  return replaceAdjustmentRecord(linkedId, 'Corrected', async (newLinkedId) => {
    await postFixedAssetPurchaseTx(input, newLinkedId, map, bank);
  });
}

export async function updateLoanMovement(
  linkedId: string,
  input: {
    kind: 'receive' | 'repay';
    date: string;
    description: string;
    amount: number; // paise
    paidFrom: 'cash' | 'bank';
    bankAccountId?: string;
  },
): Promise<string> {
  const payload: AdjustmentPaymentInput = {
    date: input.date,
    description: input.description,
    amount: input.amount,
    paidFrom: input.paidFrom,
    bankAccountId: input.bankAccountId,
  };
  assertIsoDate(payload.date);
  assertPositivePaise(payload.amount);
  const map = await codeToIdMap();
  const bank = await resolveExpensePaymentBank(
    payload.paidFrom,
    payload.bankAccountId,
    defaultCashBankId,
  );
  return replaceAdjustmentRecord(linkedId, 'Corrected', async (newLinkedId) => {
    if (input.kind === 'receive') {
      await postLoanReceivedTx(payload, newLinkedId, map, bank);
    } else {
      await postLoanRepaymentTx(payload, newLinkedId, map, bank);
    }
  });
}

export async function updateOwnerCapitalMovement(
  linkedId: string,
  input: {
    kind: 'contribution' | 'draw';
    date: string;
    description: string;
    amount: number; // paise
    paidFrom: 'cash' | 'bank';
    bankAccountId?: string;
  },
): Promise<string> {
  const payload: AdjustmentPaymentInput = {
    date: input.date,
    description: input.description,
    amount: input.amount,
    paidFrom: input.paidFrom,
    bankAccountId: input.bankAccountId,
  };
  assertIsoDate(payload.date);
  assertPositivePaise(payload.amount);
  const map = await codeToIdMap();
  const bank = await resolveExpensePaymentBank(
    payload.paidFrom,
    payload.bankAccountId,
    defaultCashBankId,
  );
  return replaceAdjustmentRecord(linkedId, 'Corrected', async (newLinkedId) => {
    if (input.kind === 'contribution') {
      await postOwnerContributionTx(payload, newLinkedId, map, bank);
    } else {
      await postOwnerDrawTx(payload, newLinkedId, map, bank);
    }
  });
}

export async function updateCreditCardEntry(
  linkedId: string,
  input: {
    kind: 'payment' | 'charge';
    date: string;
    description: string;
    amount: number; // paise
    paidFrom?: 'cash' | 'bank';
    bankAccountId?: string;
    accountCode?: number;
  },
): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  if (input.kind === 'payment') {
    const payload: AdjustmentPaymentInput = {
      date: input.date,
      description: input.description,
      amount: input.amount,
      paidFrom: input.paidFrom ?? 'bank',
      bankAccountId: input.bankAccountId,
    };
    const map = await codeToIdMap();
    const bank = await resolveExpensePaymentBank(
      payload.paidFrom,
      payload.bankAccountId,
      defaultCashBankId,
    );
    return replaceAdjustmentRecord(linkedId, 'Corrected', async (newLinkedId) => {
      await postCreditCardPaymentTx(payload, newLinkedId, map, bank);
    });
  }

  if (input.accountCode == null) throw new Error('Expense category required');
  assertExpenseAccountCode(input.accountCode);
  const map = await codeToIdMap();
  const chargeInput = {
    date: input.date,
    description: input.description,
    amount: input.amount,
    accountCode: input.accountCode,
  };
  return replaceAdjustmentRecord(linkedId, 'Corrected', async (newLinkedId) => {
    await postCreditCardChargeTx(chargeInput, newLinkedId, map);
  });
}

/** Manual bank deposit or withdrawal not linked to a sale/purchase/expense document. */
export async function recordManualBankEntry(input: {
  date: string;
  bankAccountId: string;
  type: 'deposit' | 'withdrawal';
  amount: number; // paise
  description: string;
  accountCode: number;
}): Promise<void> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);
  if (input.type === 'withdrawal') {
    assertExpenseAccountCode(input.accountCode);
  } else {
    assertIncomeAccountCode(input.accountCode);
  }

  const bank = await db.bankAccounts.get(input.bankAccountId);
  if (!bank?.isActive) throw new Error('Bank account not found');

  const map = await codeToIdMap();
  if (!map.has(input.accountCode)) {
    throw new Error(`Account ${input.accountCode} not found in chart of accounts`);
  }
  const reference = `BNK-${uuid().slice(0, 8)}`;

  await db.transaction(
    'rw',
    [db.bankTransactions, db.journalEntries],
    async () => {
      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference,
        description: input.description,
        entryType: input.type === 'deposit' ? 'receipt' : 'expense',
        lines:
          input.type === 'deposit'
            ? [
                line(map, bankCode(bank), input.amount, 0, 'Deposit'),
                line(map, input.accountCode, 0, input.amount, input.description),
              ]
            : [
                line(map, input.accountCode, input.amount, 0, input.description),
                line(map, bankCode(bank), 0, input.amount, 'Withdrawal'),
              ],
      });

      await recordBankTxn(bank, input.type === 'deposit' ? 'credit' : 'debit', input.amount, {
        date: input.date,
        description: input.description,
        category: 'other',
        reference,
        journalEntryId,
      });
    },
  );
}

/** Drop void legs and bank rows that were reversed. */
export function filterActiveBankTxns(txns: BankTransaction[]): BankTransaction[] {
  const voidRefs = new Set(
    txns.filter((t) => t.reference.startsWith('VOID-')).map((t) => t.reference),
  );
  return txns.filter((t) => {
    if (t.reference.startsWith('VOID-')) return false;
    if (voidRefs.has(`VOID-${t.id.slice(0, 8).toUpperCase()}`)) return false;
    if (voidRefs.has(`VOID-${t.reference}`)) return false;
    return true;
  });
}

/** Unique reversal reference for a single bank transaction row. */
function voidRefFor(txn: BankTransaction): string {
  return `VOID-${txn.id.slice(0, 8).toUpperCase()}`;
}

async function isBankTxnReversed(txn: BankTransaction): Promise<boolean> {
  if (txn.reference.startsWith('VOID-')) return true;
  const voidRef = voidRefFor(txn);
  const count = await db.bankTransactions
    .where('bankAccountId')
    .equals(txn.bankAccountId)
    .filter((t) => t.reference === voidRef)
    .count();
  return count > 0;
}

async function reverseSingleBankTxn(txn: BankTransaction): Promise<void> {
  const bank = await db.bankAccounts.get(txn.bankAccountId);
  if (!bank) throw new Error('Bank account not found');
  await recordBankTxn(bank, txn.type === 'credit' ? 'debit' : 'credit', txn.amount, {
    date: now().slice(0, 10),
    description: `Void ${txn.description}`,
    category: txn.category,
    reference: voidRefFor(txn),
    linkedId: txn.linkedId,
  });
}

async function voidStandaloneBankTxn(txn: BankTransaction, reason: string): Promise<void> {
  if (txn.journalEntryId) {
    const je = await db.journalEntries.get(txn.journalEntryId);
    if (je?.status === 'posted') await voidJournalEntryTx(txn.journalEntryId, reason);
  }
  await reverseSingleBankTxn(txn);
}

async function voidBankTransferByReference(reference: string, reason: string): Promise<void> {
  const legs = await db.bankTransactions.filter((t) => t.reference === reference).toArray();
  const activeLegs = legs.filter((t) => !t.reference.startsWith('VOID-'));

  const jeIds = new Set<string>();
  for (const leg of activeLegs) {
    if (await isBankTxnReversed(leg)) continue;
    if (leg.journalEntryId) jeIds.add(leg.journalEntryId);
  }

  for (const jeId of jeIds) {
    const je = await db.journalEntries.get(jeId);
    if (je?.status === 'posted') await voidJournalEntryTx(jeId, reason);
  }

  for (const leg of activeLegs) {
    if (await isBankTxnReversed(leg)) continue;
    await reverseSingleBankTxn(leg);
  }
}

async function voidSalePaymentTxn(txn: BankTransaction, reason: string): Promise<void> {
  const saleId = txn.linkedId;
  if (!saleId) throw new Error('Linked sale not found');

  const sale = await db.sales.get(saleId);
  if (!sale) throw new Error('Linked sale not found');
  if (sale.status === 'void') throw new Error('Sale is voided');
  if (txn.journalEntryId === sale.journalEntryId) {
    throw new Error('Initial sale payment — void the sale from the sale detail page');
  }

  if (txn.journalEntryId) {
    const je = await db.journalEntries.get(txn.journalEntryId);
    if (je?.status === 'posted') await voidJournalEntryTx(txn.journalEntryId, reason);
  }

  await reverseSingleBankTxn(txn);

  const paidAmount = subtractMoney(sale.paidAmount, txn.amount);
  const dueAmount = addMoney(sale.dueAmount, txn.amount);
  const status: Sale['status'] =
    dueAmount === sale.total ? 'credit' : dueAmount === 0 ? 'completed' : 'partial';

  await db.sales.update(saleId, { paidAmount, dueAmount, status, updatedAt: now() });
}

async function voidPurchasePaymentTxn(txn: BankTransaction, reason: string): Promise<void> {
  const purchaseId = txn.linkedId;
  if (!purchaseId) throw new Error('Linked purchase not found');

  const purchase = await db.purchases.get(purchaseId);
  if (!purchase) throw new Error('Linked purchase not found');
  if (purchase.status === 'void') throw new Error('Purchase is voided');
  if (txn.journalEntryId === purchase.journalEntryId) {
    throw new Error('Initial purchase payment — void the purchase from the purchase detail page');
  }

  if (txn.journalEntryId) {
    const je = await db.journalEntries.get(txn.journalEntryId);
    if (je?.status === 'posted') await voidJournalEntryTx(txn.journalEntryId, reason);
  }

  await reverseSingleBankTxn(txn);

  const paidAmount = subtractMoney(purchase.paidAmount, txn.amount);
  const dueAmount = addMoney(purchase.dueAmount, txn.amount);
  const status: Purchase['status'] =
    dueAmount === purchase.total ? 'credit' : dueAmount === 0 ? 'completed' : 'partial';

  await db.purchases.update(purchaseId, { paidAmount, dueAmount, status, updatedAt: now() });
}

export type BankTxnVoidEligibility =
  | { canVoid: true }
  | { canVoid: false; message: string; linkTo?: string; linkLabel?: string };

/** Whether a bank register row can be reversed from the banking detail screen. */
export async function getBankTxnVoidEligibility(txn: BankTransaction): Promise<BankTxnVoidEligibility> {
  if (txn.reference.startsWith('VOID-')) {
    return { canVoid: false, message: 'This is a reversal entry.' };
  }
  if (await isBankTxnReversed(txn)) {
    return { canVoid: false, message: 'This transaction has already been reversed.' };
  }
  if (txn.category === 'expense' && txn.linkedId) {
    return {
      canVoid: false,
      message: 'Void this expense from the Expenses list instead.',
      linkTo: '/expenses',
      linkLabel: 'Go to expenses',
    };
  }
  if (txn.category === 'sale' && txn.linkedId) {
    const sale = await db.sales.get(txn.linkedId);
    if (sale?.status === 'void') {
      return { canVoid: false, message: 'The linked sale is voided.' };
    }
    if (sale && txn.journalEntryId === sale.journalEntryId) {
      return {
        canVoid: false,
        message: 'This is the initial sale payment. Void the sale from the sale detail page.',
        linkTo: `/sales/${sale.id}`,
        linkLabel: 'View sale',
      };
    }
  }
  if (txn.category === 'purchase' && txn.linkedId) {
    const purchase = await db.purchases.get(txn.linkedId);
    if (purchase?.status === 'void') {
      return { canVoid: false, message: 'The linked purchase is voided.' };
    }
    if (purchase && txn.journalEntryId === purchase.journalEntryId) {
      return {
        canVoid: false,
        message: 'This is the initial purchase payment. Void the purchase from the purchase detail page.',
        linkTo: `/purchases/${purchase.id}`,
        linkLabel: 'View purchase',
      };
    }
  }
  return { canVoid: true };
}

/** Reverse a bank register entry (manual entry, transfer, or follow-up payment). */
export async function voidBankTransaction(txnId: string, reason: string): Promise<void> {
  assertDbWritable();
  const trimmed = reason.trim();
  if (!trimmed) throw new Error('Reason required');

  const txn = await db.bankTransactions.get(txnId);
  if (!txn) throw new Error('Transaction not found');

  const eligibility = await getBankTxnVoidEligibility(txn);
  if (!eligibility.canVoid) throw new Error(eligibility.message);

  await db.transaction(
    'rw',
    [db.bankTransactions, db.bankAccounts, db.journalEntries, db.sales, db.purchases],
    async () => {
      const current = await db.bankTransactions.get(txnId);
      if (!current) throw new Error('Transaction not found');

      const recheck = await getBankTxnVoidEligibility(current);
      if (!recheck.canVoid) throw new Error(recheck.message);
      if (await isBankTxnReversed(current)) {
        throw new Error('This transaction has already been reversed.');
      }

      if (current.category === 'transfer') {
        await voidBankTransferByReference(current.reference, trimmed);
        return;
      }
      if (current.category === 'sale' && current.linkedId) {
        await voidSalePaymentTxn(current, trimmed);
        return;
      }
      if (current.category === 'purchase' && current.linkedId) {
        await voidPurchasePaymentTxn(current, trimmed);
        return;
      }
      await voidStandaloneBankTxn(current, trimmed);
    },
  );
}

// ─── INVENTORY ────────────────────────────────────────────────

export async function adjustStock(input: {
  productId: string;
  date: string;
  newQty: number;
  note: string;
}): Promise<void> {
  assertIsoDate(input.date);

  const initial = await db.products.get(input.productId);
  if (!initial) throw new Error('Product not found');

  const map = await codeToIdMap();

  await db.transaction(
    'rw',
    [db.products, db.stockMovements, db.journalEntries],
    async () => {
      const product = await db.products.get(input.productId);
      if (!product) throw new Error('Product not found');
      const qtyChange = input.newQty - product.stockQty;
      if (qtyChange === 0) throw new Error('Stock quantity unchanged');

      const value = multiplyMoney(product.costPrice, Math.abs(qtyChange));

      // Adjust inventory value against retained earnings (shrinkage/gain).
      const journalEntryId = await postJournalEntryTx({
        date: input.date,
        reference: `ADJ-${product.sku}`,
        description: `Stock adjustment: ${product.name} — ${input.note}`,
        entryType: 'adjustment',
        linkedId: product.id,
        lines:
          qtyChange > 0
            ? [
                line(map, CODES.INVENTORY, value, 0, 'Stock gain'),
                line(map, CODES.RETAINED_EARNINGS, 0, value, 'Adjustment'),
              ]
            : [
                line(map, CODES.RETAINED_EARNINGS, value, 0, 'Adjustment'),
                line(map, CODES.INVENTORY, 0, value, 'Stock loss'),
              ],
      });

      await recordStockMovement(product.id, 'adjustment', qtyChange, {
        date: input.date,
        reference: `ADJ-${product.sku}`,
        linkedId: journalEntryId,
        note: input.note,
      });
      await updateProductStock(product.id, { stockQty: input.newQty });
    },
  );
}

// ─── HELPERS ──────────────────────────────────────────────────

async function defaultCashBankId(): Promise<string> {
  // Always return the deterministic cash drawer ID so that unspecified-bank
  // cash transactions post to Cash-in-Hand (101) rather than whatever the user
  // has set as their default bank, which may point to a real bank account.
  const { CASH_DRAWER_ID } = await import('@/lib/coa');
  return CASH_DRAWER_ID;
}
