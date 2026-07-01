import { db, now, uuid, type JournalEntry, type JournalLine } from '@/lib/db';
import { enqueueSync } from '@/lib/sync';
import { typeForCode } from '@/lib/coa';

export interface NewJournalEntry {
  date: string;
  reference: string;
  description: string;
  entryType: JournalEntry['entryType'];
  lines: JournalLine[];
  linkedId?: string;
  reversalOf?: string;
}

const JOURNAL_STORES = [db.journalEntries, db.syncQueue] as const;

function assertBalanced(lines: JournalLine[]): void {
  if (lines.length < 2) {
    throw new Error('Journal entry requires at least 2 lines');
  }
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    if (!Number.isInteger(line.debit) || !Number.isInteger(line.credit)) {
      throw new Error('All amounts must be integers (paise)');
    }
    if (line.debit < 0 || line.credit < 0) {
      throw new Error('Amounts must be non-negative (paise)');
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new Error('A line cannot have both debit and credit');
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
  }
  if (totalDebit !== totalCredit) {
    throw new Error(`Journal entry imbalanced: DR ${totalDebit} ≠ CR ${totalCredit}`);
  }
}

/**
 * Post a journal entry — caller MUST already be inside a Dexie rw transaction
 * that includes journalEntries and syncQueue.
 */
export async function postJournalEntryTx(entry: NewJournalEntry): Promise<string> {
  assertBalanced(entry.lines);

  const id = uuid();
  const record: JournalEntry = {
    ...entry,
    id,
    status: 'posted',
    createdAt: now(),
    updatedAt: now(),
  };

  await db.journalEntries.add(record);
  await enqueueSync('journal_entries', 'create', id, record);
  return id;
}

/**
 * Void a journal entry — marks it `void` so balance queries exclude it.
 * Caller MUST already be inside a Dexie rw transaction that includes
 * journalEntries and syncQueue. Do not post a mirror reversal: balances only
 * sum `posted` entries, so a reversal plus void would double-apply the effect.
 */
export async function voidJournalEntryTx(entryId: string, _reason: string): Promise<string> {
  const original = await db.journalEntries.get(entryId);
  if (!original) throw new Error('Journal entry not found');
  if (original.status === 'void') throw new Error('Entry already voided');

  await db.journalEntries.update(entryId, { status: 'void', updatedAt: now() });
  const updated = await db.journalEntries.get(entryId);
  if (updated) await enqueueSync('journal_entries', 'update', entryId, updated);
  return entryId;
}

/**
 * Post an immutable, balanced journal entry. Opens its own transaction when
 * called outside an existing Dexie rw scope.
 */
export async function postJournalEntry(entry: NewJournalEntry): Promise<string> {
  return db.transaction('rw', JOURNAL_STORES, () => postJournalEntryTx(entry));
}

/** Void a posted entry (status → void, excluded from balances). */
export async function voidJournalEntry(entryId: string, reason: string): Promise<string> {
  return db.transaction('rw', JOURNAL_STORES, () => voidJournalEntryTx(entryId, reason));
}

export interface AccountBalance {
  debit: number; // total debits (paise)
  credit: number; // total credits (paise)
  balance: number; // signed by normal side (paise)
}

/** Sum posted journal lines for a single account code (optionally up to a date). */
export async function getAccountBalance(
  code: number,
  upToDate?: string,
): Promise<AccountBalance> {
  const entries = await db.journalEntries.where('status').equals('posted').toArray();
  let debit = 0;
  let credit = 0;
  for (const e of entries) {
    if (upToDate && e.date > upToDate) continue;
    for (const l of e.lines) {
      if (l.accountCode === code) {
        debit += l.debit;
        credit += l.credit;
      }
    }
  }
  const type = typeForCode(code);
  const normalDebit = type === 'asset' || type === 'expense';
  const balance = normalDebit ? debit - credit : credit - debit;
  return { debit, credit, balance };
}

/** Balances for every account code touched, keyed by code. */
export async function getAllBalances(upToDate?: string): Promise<Map<number, AccountBalance>> {
  const entries = await db.journalEntries.where('status').equals('posted').toArray();
  const debits = new Map<number, number>();
  const credits = new Map<number, number>();
  for (const e of entries) {
    if (upToDate && e.date > upToDate) continue;
    for (const l of e.lines) {
      debits.set(l.accountCode, (debits.get(l.accountCode) ?? 0) + l.debit);
      credits.set(l.accountCode, (credits.get(l.accountCode) ?? 0) + l.credit);
    }
  }
  const result = new Map<number, AccountBalance>();
  const codes = new Set<number>([...debits.keys(), ...credits.keys()]);
  for (const code of codes) {
    const debit = debits.get(code) ?? 0;
    const credit = credits.get(code) ?? 0;
    const type = typeForCode(code);
    const normalDebit = type === 'asset' || type === 'expense';
    result.set(code, { debit, credit, balance: normalDebit ? debit - credit : credit - debit });
  }
  return result;
}

/** Sum of net balances across a code range (e.g. all income 400-499). */
export async function getRangeBalance(
  from: number,
  to: number,
  upToDate?: string,
): Promise<number> {
  const all = await getAllBalances(upToDate);
  let sum = 0;
  for (const [code, bal] of all) {
    if (code >= from && code <= to) sum += bal.balance;
  }
  return sum;
}
