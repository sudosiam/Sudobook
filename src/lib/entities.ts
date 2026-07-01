import {

  db,

  now,

  uuid,

  type BankAccount,

  type Customer,

  type JournalLine,

  type Product,

  type Vendor,

} from '@/lib/db';

import { CODES } from '@/lib/coa';

import { getFYStartYear } from '@/lib/sequences';

import { postJournalEntryTx } from '@/lib/accounting';

import { enqueueSync } from '@/lib/sync';

import { multiplyMoney } from '@/lib/money';

import type {

  BankAccountFormData,

  CustomerFormData,

  ProductFormData,

  VendorFormData,

} from '@/lib/validators';



const ENTITY_JOURNAL_STORES = [

  db.customers,

  db.vendors,

  db.products,

  db.bankAccounts,

  db.stockMovements,

  db.journalEntries,

  db.syncQueue,

] as const;



async function accountId(code: number): Promise<string> {

  const acc = await db.accounts.where('code').equals(code).first();

  if (!acc) throw new Error(`Account ${code} not found`);

  return acc.id;

}



/**

 * Opening balances belong to the start of the current financial year, not

 * today, so they don't distort the current period's P&L / cash flow.

 */

async function openingDate(): Promise<string> {

  const s = await db.settings.get('singleton');

  const fyMonth = s?.fyStartMonth ?? 4;

  const startYear = getFYStartYear(new Date(), fyMonth);

  return `${startYear}-${String(fyMonth).padStart(2, '0')}-01`;

}



async function openingLine(code: number, debit: number, credit: number): Promise<JournalLine> {

  return { accountId: await accountId(code), accountCode: code, debit, credit, note: 'Opening balance' };

}



// ─── CUSTOMERS ────────────────────────────────────────────────



export async function createCustomer(data: CustomerFormData): Promise<string> {

  const id = uuid();

  const customer: Customer = {

    id,

    name: data.name,

    phone: data.phone,

    address: data.address,

    openingBalance: data.openingBalance,

    notes: data.notes,

    isActive: true,

    createdAt: now(),

    updatedAt: now(),

  };



  await db.transaction('rw', ENTITY_JOURNAL_STORES, async () => {

    if (data.openingBalance > 0) {

      await postJournalEntryTx({

        date: await openingDate(),

        reference: 'OPENING',

        description: `Opening receivable — ${data.name}`,

        entryType: 'opening',

        linkedId: id,

        lines: [

          await openingLine(CODES.RECEIVABLE, data.openingBalance, 0),

          await openingLine(CODES.RETAINED_EARNINGS, 0, data.openingBalance),

        ],

      });

    }

    await db.customers.add(customer);

    await enqueueSync('customers', 'create', id, customer);

  });

  return id;

}



/** Match an existing customer by name, or create one with minimal details. */

export async function findOrCreateCustomer(

  name: string,

  existingId?: string,

): Promise<{ id: string; name: string }> {

  const trimmed = name.trim();

  if (!trimmed) throw new Error('Customer name required');



  if (existingId) {

    const linked = await db.customers.get(existingId);

    if (linked?.isActive && linked.name.toLowerCase() === trimmed.toLowerCase()) {

      return { id: linked.id, name: linked.name };

    }

  }



  const match = await db.customers

    .filter((c) => c.isActive && c.name.toLowerCase() === trimmed.toLowerCase())

    .first();



  if (match) return { id: match.id, name: match.name };



  const id = await createCustomer({

    name: trimmed,

    phone: '-',

    openingBalance: 0,

  });

  return { id, name: trimmed };

}



export async function updateCustomer(

  id: string,

  data: Partial<Pick<Customer, 'name' | 'phone' | 'address' | 'notes' | 'isActive'>>,

): Promise<void> {

  await db.transaction('rw', [db.customers, db.syncQueue], async () => {

    await db.customers.update(id, { ...data, updatedAt: now() });

    const updated = await db.customers.get(id);

    if (updated) await enqueueSync('customers', 'update', id, updated);

  });

}



// ─── VENDORS ──────────────────────────────────────────────────



export async function createVendor(data: VendorFormData): Promise<string> {

  const id = uuid();

  const vendor: Vendor = {

    id,

    name: data.name,

    phone: data.phone,

    company: data.company,

    address: data.address,

    openingBalance: data.openingBalance,

    notes: data.notes,

    isActive: true,

    createdAt: now(),

    updatedAt: now(),

  };



  await db.transaction('rw', ENTITY_JOURNAL_STORES, async () => {

    if (data.openingBalance > 0) {

      await postJournalEntryTx({

        date: await openingDate(),

        reference: 'OPENING',

        description: `Opening payable — ${data.name}`,

        entryType: 'opening',

        linkedId: id,

        lines: [

          await openingLine(CODES.RETAINED_EARNINGS, data.openingBalance, 0),

          await openingLine(CODES.PAYABLE, 0, data.openingBalance),

        ],

      });

    }

    await db.vendors.add(vendor);

    await enqueueSync('vendors', 'create', id, vendor);

  });

  return id;

}



export async function updateVendor(

  id: string,

  data: Partial<Pick<Vendor, 'name' | 'phone' | 'company' | 'address' | 'notes' | 'isActive'>>,

): Promise<void> {

  await db.transaction('rw', [db.vendors, db.syncQueue], async () => {

    await db.vendors.update(id, { ...data, updatedAt: now() });

    const updated = await db.vendors.get(id);

    if (updated) await enqueueSync('vendors', 'update', id, updated);

  });

}



// ─── PRODUCTS ─────────────────────────────────────────────────



export async function createProduct(data: ProductFormData): Promise<string> {

  const sku = data.sku.trim();

  if (sku) {

    const existing = await db.products.where('sku').equals(sku).first();

    if (existing) {

      throw new Error(`SKU "${sku}" is already used by ${existing.name}`);

    }

  }

  const id = uuid();

  const product: Product = {

    id,

    sku: data.sku,

    name: data.name,

    category: data.category,

    unit: data.unit,

    costPrice: data.costPrice,

    sellingPrice: data.sellingPrice,

    stockQty: data.stockQty,

    minStock: data.minStock,

    isActive: true,

    createdAt: now(),

    updatedAt: now(),

  };



  const openingValue = multiplyMoney(data.costPrice, data.stockQty);



  await db.transaction('rw', ENTITY_JOURNAL_STORES, async () => {

    if (openingValue > 0) {

      await postJournalEntryTx({

        date: await openingDate(),

        reference: 'OPENING',

        description: `Opening stock — ${data.name}`,

        entryType: 'opening',

        linkedId: id,

        lines: [

          await openingLine(CODES.INVENTORY, openingValue, 0),

          await openingLine(CODES.RETAINED_EARNINGS, 0, openingValue),

        ],

      });

    }

    await db.products.add(product);

    await enqueueSync('products', 'create', id, product);

    if (data.stockQty > 0) {

      const mv = {

        id: uuid(),

        productId: id,

        productName: data.name,

        date: now().slice(0, 10),

        type: 'opening' as const,

        qtyChange: data.stockQty,

        balanceAfter: data.stockQty,

        reference: 'OPENING',

        createdAt: now(),

      };

      await db.stockMovements.add(mv);

      await enqueueSync('stock_movements', 'create', mv.id, mv);

    }

  });

  return id;

}



export async function updateProduct(

  id: string,

  data: Partial<

    Pick<Product, 'sku' | 'name' | 'category' | 'unit' | 'sellingPrice' | 'minStock' | 'isActive'>

  >,

): Promise<void> {

  await db.transaction('rw', [db.products, db.syncQueue], async () => {

    await db.products.update(id, { ...data, updatedAt: now() });

    const updated = await db.products.get(id);

    if (updated) await enqueueSync('products', 'update', id, updated);

  });

}



// ─── BANK ACCOUNTS ────────────────────────────────────────────



export async function createBankAccount(data: BankAccountFormData): Promise<string> {

  const id = uuid();

  const coaCode = data.accountType === 'cash' ? CODES.CASH : CODES.BANK;

  const linkedAccountId = await accountId(coaCode);



  const bank: BankAccount = {

    id,

    accountId: linkedAccountId,

    name: data.name,

    bankName: data.bankName,

    accountNumber: data.accountNumber,

    accountType: data.accountType,

    openingBalance: data.openingBalance,

    isActive: true,

    createdAt: now(),

    updatedAt: now(),

  };



  await db.transaction('rw', ENTITY_JOURNAL_STORES, async () => {

    if (data.openingBalance > 0) {

      await postJournalEntryTx({

        date: await openingDate(),

        reference: 'OPENING',

        description: `Opening balance — ${data.name}`,

        entryType: 'opening',

        linkedId: id,

        lines: [

          await openingLine(coaCode, data.openingBalance, 0),

          await openingLine(CODES.RETAINED_EARNINGS, 0, data.openingBalance),

        ],

      });

    }

    await db.bankAccounts.add(bank);

    await enqueueSync('bank_accounts', 'create', id, bank);

  });

  return id;

}



export async function updateBankAccount(

  id: string,

  data: Partial<Pick<BankAccount, 'name' | 'bankName' | 'accountNumber' | 'accountType' | 'isActive'>>,

): Promise<void> {

  await db.transaction('rw', [db.bankAccounts, db.syncQueue], async () => {

    await db.bankAccounts.update(id, { ...data, updatedAt: now() });

    const updated = await db.bankAccounts.get(id);

    if (updated) await enqueueSync('bank_accounts', 'update', id, updated);

  });

}


