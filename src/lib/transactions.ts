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
import { enqueueSync, requestSync } from '@/lib/sync';
import { addMoney, multiplyMoney, reverseWeightedAverageCost, subtractMoney, weightedAverageCost } from '@/lib/money';
import {
  assertExpenseAccountCode,
  assertIncomeAccountCode,
  assertIsoDate,
  assertPositivePaise,
  resolveExpensePaymentBank,
} from '@/lib/runtimeValidation';
import {
  nextDocumentNumberTx,
} from '@/lib/sequences';

/** Map every account code → its UUID (chart of accounts is small, cached in-memory). */
let cachedCodeMap: Map<number, string> | null = null;

export function invalidateCodeToIdMap(): void {
  cachedCodeMap = null;
}

async function codeToIdMap(): Promise<Map<number, string>> {
  if (cachedCodeMap) return cachedCodeMap;
  const accounts = await db.accounts.toArray();
  const map = new Map<number, string>();
  for (const a of accounts) map.set(a.code, a.id);
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
  await enqueueSync('bank_transactions', 'create', txn.id, txn);
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
  await enqueueSync('stock_movements', 'create', mv.id, mv);
  return balanceAfter;
}

/** Persist a product change and queue it for cloud sync (inventory must sync). */
async function updateProductStock(
  id: string,
  patch: Partial<Product>,
): Promise<void> {
  await db.products.update(id, { ...patch, updatedAt: now() });
  const updated = await db.products.get(id);
  if (updated) await enqueueSync('products', 'update', id, updated);
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
  if (total <= 0) throw new Error('Sale total must be greater than zero');
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
    [db.sales, db.products, db.stockMovements, db.bankTransactions, db.journalEntries, db.syncQueue, db.settings],
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
      if (paidAmount > 0 && bank) {
        revenueLines.push(line(map, bankCode(bank), paidAmount, 0, 'Cash/Bank received'));
      }
      if (dueAmount > 0) {
        revenueLines.push(line(map, CODES.RECEIVABLE, dueAmount, 0, 'On credit'));
      }
      revenueLines.push(line(map, CODES.PRODUCT_SALES, 0, total, 'Product sales'));

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
      await enqueueSync('sales', 'create', saleId, sale);

      for (const item of items) {
        const product = await db.products.get(item.productId);
        if (product) {
          const balanceAfter = await recordStockMovement(product.id, 'sale', -item.qty, {
            date: input.date,
            reference: saleNumber,
            linkedId: saleId,
          });
          await updateProductStock(product.id, { stockQty: balanceAfter });
        }
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

  requestSync();
  return saleId;
}

export async function voidSale(saleId: string, reason: string): Promise<void> {
  const sale = await db.sales.get(saleId);
  if (!sale) throw new Error('Sale not found');
  if (sale.status === 'void') throw new Error('Sale already voided');

  await db.transaction(
    'rw',
    [db.sales, db.products, db.stockMovements, db.bankAccounts, db.bankTransactions, db.journalEntries, db.syncQueue],
    async () => {
      await voidLinkedJournalEntries(saleId, [sale.journalEntryId, sale.cogsEntryId], reason);

      // Restore stock qty only. COGS/inventory GL is reversed by voided journal entries;
      // re-blending WAC here corrupts cost when stock was replenished after the sale.
      for (const item of sale.items) {
        const product = await db.products.get(item.productId);
        if (product) {
          const balanceAfter = await recordStockMovement(product.id, 'adjustment', item.qty, {
            date: now().slice(0, 10),
            reference: `VOID-${sale.saleNumber}`,
            linkedId: saleId,
            note: 'Sale voided — stock restored',
          });
          await updateProductStock(product.id, { stockQty: balanceAfter });
        }
      }

      // Reverse every bank movement (initial receipt + later payments).
      await reverseBankTxnsFor(saleId);

      await db.sales.update(saleId, { status: 'void', updatedAt: now() });
      const updated = await db.sales.get(saleId);
      if (updated) await enqueueSync('sales', 'update', saleId, updated);
    },
  );
  requestSync();
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
    [db.sales, db.bankTransactions, db.journalEntries, db.syncQueue],
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
      const updated = await db.sales.get(saleId);
      if (updated) await enqueueSync('sales', 'update', saleId, updated);
    },
  );
  requestSync();
}

// ─── PURCHASES ────────────────────────────────────────────────

export interface RecordPurchaseInput {
  date: string;
  vendorId: string;
  vendorName: string;
  items: PurchaseItem[];
  paymentMethod: Purchase['paymentMethod'];
  bankAccountId?: string;
  paidAmount: number;
  notes?: string;
}

export async function recordPurchase(input: RecordPurchaseInput): Promise<string> {
  assertIsoDate(input.date);
  if (input.items.length === 0) throw new Error('At least one item required');
  const subtotal = addMoney(...input.items.map((i) => i.total));
  const total = subtotal;
  if (total <= 0) throw new Error('Purchase total must be greater than zero');
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

  const lines: JournalLine[] = [line(map, CODES.INVENTORY, total, 0, 'Inventory received')];
  if (paidAmount > 0 && bank) {
    lines.push(line(map, bankCode(bank), 0, paidAmount, 'Cash/Bank paid'));
  }
  if (dueAmount > 0) {
    lines.push(line(map, CODES.PAYABLE, 0, dueAmount, 'On credit'));
  }

  const status: Purchase['status'] =
    dueAmount === 0 ? 'completed' : paidAmount > 0 ? 'partial' : 'credit';

  await db.transaction(
    'rw',
    [db.purchases, db.products, db.stockMovements, db.bankTransactions, db.journalEntries, db.syncQueue, db.settings],
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
      await enqueueSync('purchases', 'create', purchaseId, purchase);

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
            item.unitCost,
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

  requestSync();
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
    [db.purchases, db.bankTransactions, db.journalEntries, db.syncQueue],
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
      const updated = await db.purchases.get(purchaseId);
      if (updated) await enqueueSync('purchases', 'update', purchaseId, updated);
    },
  );
  requestSync();
}

export async function voidPurchase(purchaseId: string, reason: string): Promise<void> {
  const purchase = await db.purchases.get(purchaseId);
  if (!purchase) throw new Error('Purchase not found');
  if (purchase.status === 'void') throw new Error('Purchase already voided');

  await db.transaction(
    'rw',
    [db.purchases, db.products, db.stockMovements, db.bankAccounts, db.bankTransactions, db.journalEntries, db.syncQueue],
    async () => {
      await voidLinkedJournalEntries(purchaseId, [purchase.journalEntryId], reason);

      for (const item of purchase.items) {
        const product = await db.products.get(item.productId);
        if (!product) continue;
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
        // Only reverse WAC when the full purchase batch is still on hand (no intervening sales).
        if (product.stockQty === item.qty) {
          stockPatch.costPrice = reverseWeightedAverageCost(
            product.stockQty,
            product.costPrice,
            item.qty,
            item.unitCost,
          );
        }
        await updateProductStock(product.id, stockPatch);
      }

      await reverseBankTxnsFor(purchaseId);

      await db.purchases.update(purchaseId, { status: 'void', updatedAt: now() });
      const updated = await db.purchases.get(purchaseId);
      if (updated) await enqueueSync('purchases', 'update', purchaseId, updated);
    },
  );
  requestSync();
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
    [db.expenses, db.bankTransactions, db.journalEntries, db.syncQueue, db.settings],
    async () => {
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
      await enqueueSync('expenses', 'create', expenseId, expense);
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

  requestSync();
  return expenseId;
}

export async function voidExpense(expenseId: string, reason: string): Promise<void> {
  const expense = await db.expenses.get(expenseId);
  if (!expense) throw new Error('Expense not found');
  if (expense.voidedAt) throw new Error('Expense already voided');

  await db.transaction(
    'rw',
    [db.expenses, db.bankAccounts, db.bankTransactions, db.journalEntries, db.syncQueue],
    async () => {
      await voidLinkedJournalEntries(expenseId, [expense.journalEntryId], reason);
      await reverseBankTxnsFor(expenseId);
      await db.expenses.update(expenseId, { voidedAt: now(), updatedAt: now() });
      const updated = await db.expenses.get(expenseId);
      if (updated) await enqueueSync('expenses', 'update', expenseId, updated);
    },
  );
  requestSync();
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
    [db.bankTransactions, db.journalEntries, db.syncQueue],
    async () => {
      // If both post to the same COA code (e.g. two banks → 102), the journal
      // nets to zero, which is invalid. Post only when codes differ; otherwise
      // the transfer is purely operational (tracked via bank transactions).
      let journalEntryId: string | undefined;
      if (bankCode(from) !== bankCode(to)) {
        journalEntryId = await postJournalEntryTx({
          date: input.date,
          reference,
          description: input.note ?? `Transfer ${from.name} → ${to.name}`,
          entryType: 'transfer',
          lines: [
            line(map, bankCode(to), input.amount, 0, `To ${to.name}`),
            line(map, bankCode(from), 0, input.amount, `From ${from.name}`),
          ],
        });
      }

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

/** Capital expenditure — debits Fixed Assets (105), credits cash/bank. */
export async function recordFixedAssetPurchase(input: {
  date: string;
  description: string;
  amount: number; // paise
  paidFrom: 'cash' | 'bank';
  bankAccountId?: string;
}): Promise<string> {
  assertIsoDate(input.date);
  assertPositivePaise(input.amount);

  const map = await codeToIdMap();
  const linkedId = uuid();
  const reference = `FA-${uuid().slice(0, 8).toUpperCase()}`;

  const bank = await resolveExpensePaymentBank(
    input.paidFrom,
    input.bankAccountId,
    defaultCashBankId,
  );

  await db.transaction(
    'rw',
    [db.bankTransactions, db.journalEntries, db.syncQueue],
    async () => {
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
    },
  );

  return linkedId;
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
    [db.bankTransactions, db.journalEntries, db.syncQueue],
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
    [db.products, db.stockMovements, db.journalEntries, db.syncQueue],
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
  const settings = await db.settings.get('singleton');
  if (!settings) throw new Error('Settings not initialised');
  return settings.defaultBankId;
}
