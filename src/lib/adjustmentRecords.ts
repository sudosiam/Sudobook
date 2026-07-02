import { db, type JournalEntry } from '@/lib/db';
import { CODES } from '@/lib/coa';
import type {
  CreditCardFormData,
  FixedAssetPurchaseFormData,
  LoanMovementFormData,
  OwnerCapitalFormData,
} from '@/lib/validators';

export interface AdjustmentListItem {
  linkedId: string;
  journalEntryId: string;
  date: string;
  title: string;
  amount: number; // paise
  subtitle?: string;
}

async function getPostedEntryByLinkedId(linkedId: string): Promise<JournalEntry | undefined> {
  const entries = await db.journalEntries.where('linkedId').equals(linkedId).toArray();
  return entries.find((e) => e.status === 'posted');
}

async function getPaymentDetails(linkedId: string): Promise<{
  paidFrom: 'cash' | 'bank';
  bankAccountId?: string;
}> {
  const txns = await db.bankTransactions.where('linkedId').equals(linkedId).toArray();
  const orig = txns.find((t) => !t.reference.startsWith('VOID-'));
  if (!orig) return { paidFrom: 'cash' };
  const bank = await db.bankAccounts.get(orig.bankAccountId);
  if (!bank) return { paidFrom: 'cash' };
  if (bank.accountType === 'cash') return { paidFrom: 'cash' };
  return { paidFrom: 'bank', bankAccountId: bank.id };
}

function lineAmount(entry: JournalEntry, code: number, side: 'debit' | 'credit'): number {
  const line = entry.lines.find((l) => l.accountCode === code && l[side] > 0);
  return line?.[side] ?? 0;
}

function sortNewestFirst(items: AdjustmentListItem[]): AdjustmentListItem[] {
  return items.sort((a, b) => b.date.localeCompare(a.date) || b.linkedId.localeCompare(a.linkedId));
}

function toListItem(
  entry: JournalEntry,
  title: string,
  amount: number,
  subtitle?: string,
): AdjustmentListItem {
  if (!entry.linkedId) throw new Error('Adjustment entry missing linkedId');
  return {
    linkedId: entry.linkedId,
    journalEntryId: entry.id,
    date: entry.date,
    title,
    amount,
    subtitle,
  };
}

export async function listFixedAssetRecords(): Promise<AdjustmentListItem[]> {
  const entries = await db.journalEntries
    .filter((e) => e.status === 'posted' && e.description.startsWith('Fixed asset:'))
    .toArray();
  const items = entries.map((e) => {
    const assetLine = e.lines.find((l) => l.accountCode === CODES.FIXED_ASSETS && l.debit > 0);
    const title = assetLine?.note?.trim() || e.description.replace(/^Fixed asset:\s*/, '');
    return toListItem(e, title, assetLine?.debit ?? 0);
  });
  return sortNewestFirst(items);
}

export async function getFixedAssetEditDefaults(linkedId: string): Promise<FixedAssetPurchaseFormData | null> {
  const entry = await getPostedEntryByLinkedId(linkedId);
  if (!entry?.description.startsWith('Fixed asset:')) return null;
  const assetLine = entry.lines.find((l) => l.accountCode === CODES.FIXED_ASSETS && l.debit > 0);
  const payment = await getPaymentDetails(linkedId);
  return {
    date: entry.date,
    description: assetLine?.note?.trim() || entry.description.replace(/^Fixed asset:\s*/, ''),
    amount: assetLine?.debit ?? 0,
    paidFrom: payment.paidFrom,
    bankAccountId: payment.bankAccountId ?? '',
  };
}

export async function listLoanRecords(): Promise<AdjustmentListItem[]> {
  const entries = await db.journalEntries
    .filter(
      (e) =>
        e.status === 'posted' &&
        (e.description.startsWith('Loan received:') || e.description.startsWith('Loan repayment:')),
    )
    .toArray();
  const items = entries.map((e) => {
    const received = e.description.startsWith('Loan received:');
    const amount = received
      ? lineAmount(e, CODES.LOANS, 'credit')
      : lineAmount(e, CODES.LOANS, 'debit');
    const loanLine = e.lines.find((l) => l.accountCode === CODES.LOANS);
    const title =
      loanLine?.note?.trim() ||
      e.description.replace(/^Loan (received|repayment):\s*/, '');
    return toListItem(e, title, amount, received ? 'Received' : 'Repayment');
  });
  return sortNewestFirst(items);
}

export async function getLoanEditDefaults(linkedId: string): Promise<LoanMovementFormData | null> {
  const entry = await getPostedEntryByLinkedId(linkedId);
  if (!entry) return null;
  const received = entry.description.startsWith('Loan received:');
  const repayment = entry.description.startsWith('Loan repayment:');
  if (!received && !repayment) return null;
  const loanLine = entry.lines.find((l) => l.accountCode === CODES.LOANS);
  const payment = await getPaymentDetails(linkedId);
  return {
    kind: received ? 'receive' : 'repay',
    date: entry.date,
    description:
      loanLine?.note?.trim() ||
      entry.description.replace(/^Loan (received|repayment):\s*/, ''),
    amount: received ? lineAmount(entry, CODES.LOANS, 'credit') : lineAmount(entry, CODES.LOANS, 'debit'),
    paidFrom: payment.paidFrom,
    bankAccountId: payment.bankAccountId ?? '',
  };
}

export async function listOwnerCapitalRecords(): Promise<AdjustmentListItem[]> {
  const entries = await db.journalEntries
    .filter(
      (e) =>
        e.status === 'posted' &&
        (e.description.startsWith('Owner contribution:') || e.description.startsWith('Owner draw:')),
    )
    .toArray();
  const items = entries.map((e) => {
    const contribution = e.description.startsWith('Owner contribution:');
    const amount = contribution
      ? lineAmount(e, CODES.CAPITAL, 'credit')
      : lineAmount(e, CODES.CAPITAL, 'debit');
    const capLine = e.lines.find((l) => l.accountCode === CODES.CAPITAL);
    const title =
      capLine?.note?.trim() ||
      e.description.replace(/^Owner (contribution|draw):\s*/, '');
    return toListItem(e, title, amount, contribution ? 'Contribution' : 'Draw');
  });
  return sortNewestFirst(items);
}

export async function getOwnerCapitalEditDefaults(linkedId: string): Promise<OwnerCapitalFormData | null> {
  const entry = await getPostedEntryByLinkedId(linkedId);
  if (!entry) return null;
  const contribution = entry.description.startsWith('Owner contribution:');
  const draw = entry.description.startsWith('Owner draw:');
  if (!contribution && !draw) return null;
  const capLine = entry.lines.find((l) => l.accountCode === CODES.CAPITAL);
  const payment = await getPaymentDetails(linkedId);
  return {
    kind: contribution ? 'contribution' : 'draw',
    date: entry.date,
    description:
      capLine?.note?.trim() ||
      entry.description.replace(/^Owner (contribution|draw):\s*/, ''),
    amount: contribution
      ? lineAmount(entry, CODES.CAPITAL, 'credit')
      : lineAmount(entry, CODES.CAPITAL, 'debit'),
    paidFrom: payment.paidFrom,
    bankAccountId: payment.bankAccountId ?? '',
  };
}

export async function listCreditCardRecords(): Promise<AdjustmentListItem[]> {
  const entries = await db.journalEntries
    .filter(
      (e) =>
        e.status === 'posted' &&
        (e.description.startsWith('Credit card payment:') ||
          (e.description.startsWith('Credit card:') && e.entryType === 'expense')),
    )
    .toArray();
  const items = entries.map((e) => {
    const payment = e.description.startsWith('Credit card payment:');
    if (payment) {
      const amount = lineAmount(e, CODES.CREDIT_CARDS, 'debit');
      const cardLine = e.lines.find((l) => l.accountCode === CODES.CREDIT_CARDS && l.debit > 0);
      const title =
        cardLine?.note?.trim() || e.description.replace(/^Credit card payment:\s*/, '');
      return toListItem(e, title, amount, 'Bill payment');
    }
    const expenseLine = e.lines.find((l) => l.accountCode >= 502 && l.accountCode < 600 && l.debit > 0);
    const title =
      expenseLine?.note?.trim() || e.description.replace(/^Credit card:\s*/, '');
    return toListItem(e, title, expenseLine?.debit ?? 0, 'Card expense');
  });
  return sortNewestFirst(items);
}

export async function getCreditCardEditDefaults(linkedId: string): Promise<CreditCardFormData | null> {
  const entry = await getPostedEntryByLinkedId(linkedId);
  if (!entry) return null;
  if (entry.description.startsWith('Credit card payment:')) {
    const cardLine = entry.lines.find((l) => l.accountCode === CODES.CREDIT_CARDS && l.debit > 0);
    const payment = await getPaymentDetails(linkedId);
    return {
      kind: 'payment',
      date: entry.date,
      description:
        cardLine?.note?.trim() || entry.description.replace(/^Credit card payment:\s*/, ''),
      amount: cardLine?.debit ?? 0,
      paidFrom: payment.paidFrom,
      bankAccountId: payment.bankAccountId ?? '',
    };
  }
  if (entry.description.startsWith('Credit card:') && entry.entryType === 'expense') {
    const expenseLine = entry.lines.find((l) => l.accountCode >= 502 && l.accountCode < 600 && l.debit > 0);
    return {
      kind: 'charge',
      date: entry.date,
      description:
        expenseLine?.note?.trim() || entry.description.replace(/^Credit card:\s*/, ''),
      amount: expenseLine?.debit ?? 0,
      accountCode: expenseLine?.accountCode,
    };
  }
  return null;
}
