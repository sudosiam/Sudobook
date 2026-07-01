import { z } from 'zod';
import {
  BANK_ENTRY_REASON_IDS,
  getBankEntryReason,
  reasonAllowsCategoryOverride,
} from '@/lib/bankEntryReasons';

const paise = z.number().int('Must be a whole paise amount').min(0, 'Cannot be negative');
const positivePaise = z.number().int().min(1, 'Amount required');

/** Account code that must fall inside the expense range (502–599), excluding COGS. */
const expenseCode = z
  .number()
  .int()
  .min(502, 'Must be an expense account (502–599)')
  .max(599, 'Must be an expense account (502–599)');

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((d) => d <= new Date().toISOString().slice(0, 10), 'Date cannot be in the future');

export const saleItemSchema = z
  .object({
    productId: z.string().min(1, 'Select a product'),
    productName: z.string().min(1),
    qty: z.number().int().min(1, 'Qty ≥ 1'),
    unitPrice: paise,
    costPrice: paise,
    total: paise,
  })
  .refine((v) => v.total === v.unitPrice * v.qty, {
    message: 'Line total does not match qty × price',
    path: ['total'],
  });

export const saleSchema = z
  .object({
    date: isoDate,
    customerId: z.string().optional(),
    customerName: z.string().min(1, 'Customer name required'),
    items: z.array(saleItemSchema).min(1, 'Add at least one item'),
    discount: paise,
    /** How the received portion was paid — full/partial/credit is derived from paidAmount vs total. */
    paymentMethod: z.enum(['cash', 'bank', 'upi']),
    bankAccountId: z.string().optional(),
    paidAmount: paise,
    notes: z.string().optional(),
  })
  .refine(
    (v) => {
      const subtotal = v.items.reduce((s, i) => s + i.total, 0);
      const total = Math.max(subtotal - v.discount, 0);
      return v.paidAmount <= total;
    },
    { message: 'Received amount cannot exceed total', path: ['paidAmount'] },
  )
  .refine(
    (v) =>
      v.paidAmount === 0 ||
      v.paymentMethod === 'cash' ||
      (v.paymentMethod === 'bank' || v.paymentMethod === 'upi' ? !!v.bankAccountId : true),
    { message: 'Select a bank account', path: ['bankAccountId'] },
  )
  .refine(
    (v) => {
      const subtotal = v.items.reduce((s, i) => s + i.total, 0);
      return v.discount <= subtotal;
    },
    { message: 'Discount cannot exceed subtotal', path: ['discount'] },
  );

export const purchaseItemSchema = z
  .object({
    productId: z.string().min(1, 'Select a product'),
    productName: z.string().min(1),
    qty: z.number().int().min(1, 'Qty ≥ 1'),
    unitCost: paise,
    total: paise,
  })
  .refine((v) => v.total === v.unitCost * v.qty, {
    message: 'Line total does not match qty × cost',
    path: ['total'],
  });

export const purchaseSchema = z
  .object({
    date: isoDate,
    vendorId: z.string().min(1, 'Select a vendor'),
    vendorName: z.string().min(1),
    items: z.array(purchaseItemSchema).min(1, 'Add at least one item'),
    paymentMethod: z.enum(['cash', 'bank', 'upi', 'partial', 'credit']),
    bankAccountId: z.string().optional(),
    paidAmount: paise,
    notes: z.string().optional(),
  })
  .refine(
    (v) => (v.paymentMethod === 'bank' || v.paymentMethod === 'upi' ? !!v.bankAccountId : true),
    { message: 'Select a bank account', path: ['bankAccountId'] },
  )
  .refine((v) => v.paymentMethod !== 'partial' || v.paidAmount > 0, {
    message: 'Enter the amount paid now',
    path: ['paidAmount'],
  })
  .refine(
    (v) => {
      if (v.paymentMethod !== 'partial') return true;
      const total = v.items.reduce((s, i) => s + i.total, 0);
      return v.paidAmount < total;
    },
    { message: 'Partial payment must be less than the total', path: ['paidAmount'] },
  )
  .refine((v) => v.items.reduce((s, i) => s + i.total, 0) > 0, {
    message: 'Purchase total must be greater than zero',
    path: ['items'],
  });

export const expenseSchema = z
  .object({
    date: isoDate,
    accountCode: expenseCode,
    category: z.string().min(1, 'Category required'),
    description: z.string().min(1, 'Description required'),
    amount: positivePaise,
    paidFrom: z.enum(['cash', 'bank']),
    bankAccountId: z.string().optional(),
  })
  .refine((v) => (v.paidFrom === 'bank' ? !!v.bankAccountId : true), {
    message: 'Select a bank account',
    path: ['bankAccountId'],
  });

export const customerSchema = z.object({
  name: z.string().min(1, 'Name required'),
  phone: z
    .string()
    .min(1, 'Phone required')
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => /^[6-9]\d{9}$/.test(s), {
      message: 'Enter a valid 10-digit Indian mobile number',
    }),
  address: z.string().optional(),
  openingBalance: paise,
  notes: z.string().optional(),
});

export const vendorSchema = z.object({
  name: z.string().min(1, 'Name required'),
  phone: z
    .string()
    .min(1, 'Phone required')
    .transform((s) => s.replace(/\D/g, ''))
    .refine((s) => /^[6-9]\d{9}$/.test(s), {
      message: 'Enter a valid 10-digit Indian mobile number',
    }),
  company: z.string().optional(),
  address: z.string().optional(),
  openingBalance: paise,
  notes: z.string().optional(),
});

export const productSchema = z.object({
  sku: z.string().min(1, 'SKU required'),
  name: z.string().min(1, 'Name required'),
  category: z.string().min(1, 'Category required'),
  unit: z.string().min(1, 'Unit required'),
  costPrice: paise,
  sellingPrice: paise,
  stockQty: z.number().int().min(0),
  minStock: z.number().int().min(0),
});

export const productCategorySchema = z.object({
  name: z.string().min(1, 'Name required'),
  skuPrefix: z
    .string()
    .min(1, 'Prefix required')
    .max(6, 'Max 6 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Letters and numbers only'),
});

export type ProductCategoryFormData = z.infer<typeof productCategorySchema>;

export const bankAccountSchema = z.object({
  name: z.string().min(1, 'Name required'),
  bankName: z.string().min(1, 'Bank name required'),
  accountNumber: z.string().min(1, 'Account number required'),
  accountType: z.enum(['current', 'savings', 'cash']),
  openingBalance: paise,
});

export const paymentSchema = z
  .object({
    date: isoDate,
    amount: positivePaise,
    method: z.enum(['cash', 'bank', 'upi']),
    bankAccountId: z.string().optional(),
    note: z.string().optional(),
  })
  .refine((v) => (v.method === 'cash' ? true : !!v.bankAccountId), {
    message: 'Select a bank account',
    path: ['bankAccountId'],
  });

/** Payment against a document with a known outstanding balance (paise). */
export function paymentAgainstDueSchema(maxDue: number) {
  return paymentSchema.refine((v) => v.amount <= maxDue, {
    message: 'Amount cannot exceed the outstanding balance',
    path: ['amount'],
  });
}

export const transferSchema = z
  .object({
    date: isoDate,
    fromBankId: z.string().min(1, 'Select source'),
    toBankId: z.string().min(1, 'Select destination'),
    amount: positivePaise,
    note: z.string().optional(),
  })
  .refine((v) => v.fromBankId !== v.toBankId, {
    message: 'Source and destination must differ',
    path: ['toBankId'],
  });

export const stockAdjustmentSchema = z.object({
  date: isoDate,
  newQty: z.number().int().min(0, 'Qty ≥ 0'),
  note: z.string().min(1, 'Reason required'),
});

export const fixedAssetPurchaseSchema = z
  .object({
    date: isoDate,
    description: z.string().min(1, 'Description required'),
    amount: positivePaise,
    paidFrom: z.enum(['cash', 'bank']),
    bankAccountId: z.string().optional(),
  })
  .refine((v) => (v.paidFrom === 'bank' ? !!v.bankAccountId : true), {
    message: 'Select a bank account',
    path: ['bankAccountId'],
  });

export const manualBankEntrySchema = z
  .object({
    date: isoDate,
    bankAccountId: z.string().min(1, 'Select an account'),
    type: z.enum(['deposit', 'withdrawal']),
    reason: z.enum(BANK_ENTRY_REASON_IDS),
    counterpartyBankId: z.string().optional(),
    accountCode: z.number().int().optional(),
    amount: positivePaise,
    description: z.string().min(1, 'Description required'),
  })
  .superRefine((v, ctx) => {
    const config = getBankEntryReason(v.reason);
    if (config.type !== v.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reason does not match deposit/withdrawal type',
        path: ['reason'],
      });
      return;
    }

    if (config.subType === 'transfer') {
      if (!v.counterpartyBankId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select the other account',
          path: ['counterpartyBankId'],
        });
      } else if (v.counterpartyBankId === v.bankAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Accounts must be different',
          path: ['counterpartyBankId'],
        });
      }
      return;
    }

    const code = reasonAllowsCategoryOverride(v.reason) ? v.accountCode : config.accountCode;
    if (code == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a category',
        path: ['accountCode'],
      });
      return;
    }

    const valid =
      v.type === 'withdrawal'
        ? code >= 502 && code <= 599
        : code >= 402 && code <= 499;

    if (!valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid account category',
        path: ['accountCode'],
      });
    }
  });

export const recurringExpenseSchema = z
  .object({
    name: z.string().min(1, 'Name required'),
    accountCode: expenseCode,
    category: z.string().min(1),
    description: z.string().min(1, 'Description required'),
    amount: positivePaise,
    paidFrom: z.enum(['cash', 'bank']),
    bankAccountId: z.string().optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(28),
  })
  .refine((v) => (v.paidFrom === 'bank' ? !!v.bankAccountId : true), {
    message: 'Select a bank account',
    path: ['bankAccountId'],
  });

export type SaleFormData = z.infer<typeof saleSchema>;
export type PurchaseFormData = z.infer<typeof purchaseSchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type CustomerFormData = z.infer<typeof customerSchema>;
export type VendorFormData = z.infer<typeof vendorSchema>;
export type ProductFormData = z.infer<typeof productSchema>;
export type BankAccountFormData = z.infer<typeof bankAccountSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
export type TransferFormData = z.infer<typeof transferSchema>;
export type StockAdjustmentFormData = z.infer<typeof stockAdjustmentSchema>;
export type FixedAssetPurchaseFormData = z.infer<typeof fixedAssetPurchaseSchema>;
export type ManualBankEntryFormData = z.infer<typeof manualBankEntrySchema>;
export type RecurringExpenseFormData = z.infer<typeof recurringExpenseSchema>;
