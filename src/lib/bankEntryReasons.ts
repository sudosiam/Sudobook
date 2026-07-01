import { CODES } from '@/lib/coa';

export type BankEntryReasonId =
  | 'cash_deposit'
  | 'transfer_in'
  | 'bank_interest'
  | 'refund_received'
  | 'pick_income_category'
  | 'cash_withdrawal'
  | 'transfer_out'
  | 'bank_charges'
  | 'rent'
  | 'salaries'
  | 'electricity'
  | 'marketing'
  | 'misc_expense'
  | 'pick_expense_category';

export interface BankEntryReason {
  id: BankEntryReasonId;
  label: string;
  type: 'deposit' | 'withdrawal';
  subType: 'transfer' | 'category';
  /** Preset COA code when subType is category (other_* reasons let user pick). */
  accountCode?: number;
  descriptionPlaceholder: string;
}

export const BANK_ENTRY_REASONS: BankEntryReason[] = [
  {
    id: 'cash_deposit',
    label: 'Cash deposited to bank',
    type: 'deposit',
    subType: 'transfer',
    descriptionPlaceholder: 'e.g. Cash deposited at HDFC',
  },
  {
    id: 'transfer_in',
    label: 'Transfer from another account',
    type: 'deposit',
    subType: 'transfer',
    descriptionPlaceholder: 'e.g. Moved from SBI to HDFC',
  },
  {
    id: 'bank_interest',
    label: 'Bank interest',
    type: 'deposit',
    subType: 'category',
    accountCode: CODES.OTHER_INCOME,
    descriptionPlaceholder: 'e.g. Quarterly savings interest',
  },
  {
    id: 'refund_received',
    label: 'Refund received',
    type: 'deposit',
    subType: 'category',
    accountCode: CODES.OTHER_INCOME,
    descriptionPlaceholder: 'e.g. Vendor refund to bank',
  },
  {
    id: 'pick_income_category',
    label: 'Other deposit — choose category',
    type: 'deposit',
    subType: 'category',
    descriptionPlaceholder: 'e.g. Commission, scrap sale',
  },
  {
    id: 'cash_withdrawal',
    label: 'Cash withdrawal (ATM / counter)',
    type: 'withdrawal',
    subType: 'transfer',
    descriptionPlaceholder: 'e.g. ATM cash withdrawal',
  },
  {
    id: 'transfer_out',
    label: 'Transfer to another account',
    type: 'withdrawal',
    subType: 'transfer',
    descriptionPlaceholder: 'e.g. Moved to cash drawer',
  },
  {
    id: 'bank_charges',
    label: 'Bank charges / fees',
    type: 'withdrawal',
    subType: 'category',
    accountCode: CODES.BANK_CHARGES,
    descriptionPlaceholder: 'e.g. Monthly account maintenance',
  },
  {
    id: 'rent',
    label: 'Rent paid from bank',
    type: 'withdrawal',
    subType: 'category',
    accountCode: CODES.RENT,
    descriptionPlaceholder: 'e.g. Showroom rent — NEFT',
  },
  {
    id: 'salaries',
    label: 'Salaries paid from bank',
    type: 'withdrawal',
    subType: 'category',
    accountCode: CODES.SALARIES,
    descriptionPlaceholder: 'e.g. Staff salary transfer',
  },
  {
    id: 'electricity',
    label: 'Electricity paid from bank',
    type: 'withdrawal',
    subType: 'category',
    accountCode: CODES.ELECTRICITY,
    descriptionPlaceholder: 'e.g. WBSEDCL bill payment',
  },
  {
    id: 'marketing',
    label: 'Marketing paid from bank',
    type: 'withdrawal',
    subType: 'category',
    accountCode: CODES.MARKETING,
    descriptionPlaceholder: 'e.g. Facebook ads — UPI',
  },
  {
    id: 'misc_expense',
    label: 'Miscellaneous expense',
    type: 'withdrawal',
    subType: 'category',
    accountCode: CODES.MISC,
    descriptionPlaceholder: 'e.g. One-off bank payment',
  },
  {
    id: 'pick_expense_category',
    label: 'Other withdrawal — choose category',
    type: 'withdrawal',
    subType: 'category',
    descriptionPlaceholder: 'e.g. One-off payment — pick expense below',
  },
];

export const BANK_ENTRY_REASON_IDS = BANK_ENTRY_REASONS.map((r) => r.id) as [
  BankEntryReasonId,
  ...BankEntryReasonId[],
];

export function bankEntryReasonsForType(type: 'deposit' | 'withdrawal'): BankEntryReason[] {
  return BANK_ENTRY_REASONS.filter((r) => r.type === type);
}

export function getBankEntryReason(id: BankEntryReasonId): BankEntryReason {
  const found = BANK_ENTRY_REASONS.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown bank entry reason: ${id}`);
  return found;
}

export function defaultReasonForType(type: 'deposit' | 'withdrawal'): BankEntryReasonId {
  return type === 'deposit' ? 'cash_deposit' : 'cash_withdrawal';
}

/** Reasons where the user picks the income/expense account (no preset category). */
export function reasonAllowsCategoryOverride(id: BankEntryReasonId): boolean {
  return id === 'pick_income_category' || id === 'pick_expense_category';
}
