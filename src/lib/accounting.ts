import { db, now, uuid, type JournalEntry, type JournalLine } from '@/lib/db';
import { bumpDashboardRevisionTx } from '@/lib/dashboardCache';
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

/** Dexie rw scope required whenever postJournalEntryTx / voidJournalEntryTx runs. */
export const JOURNAL_STORES = [db.journalEntries, db.settings] as const;

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
 * Stream posted journal lines without loading the full table into memory.
 * Uses the `date` index when a range or cutoff is provided.
 */
export async function foldPostedJournalLines(
  filter: { upToDate?: string; start?: string; end?: string },
  onLine: (accountCode: number, debit: number, credit: number) => void,
): Promise<void> {
  const ingest = (entry: JournalEntry) => {
    if (entry.status !== 'posted') return;
    if (filter.upToDate && entry.date > filter.upToDate) return;
    if (filter.start && entry.date < filter.start) return;
    if (filter.end && entry.date > filter.end) return;
    for (const l of entry.lines) {
      onLine(l.accountCode, l.debit, l.credit);
    }
  };

  if (filter.start !== undefined && filter.end !== undefined) {
    await db.journalEntries.where('date').between(filter.start, filter.end, true, true).each(ingest);
  } else if (filter.upToDate) {
    await db.journalEntries.where('date').belowOrEqual(filter.upToDate).each(ingest);
  } else {
    await db.journalEntries.where('status').equals('posted').each(ingest);
  }
}

function balancesFromMaps(
  debits: Map<number, number>,
  credits: Map<number, number>,
): Map<number, AccountBalance> {
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

/**
 * Post a journal entry — caller MUST already be inside a Dexie rw transaction
 * that includes journalEntries.
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
  await bumpDashboardRevisionTx();
  return id;
}

/**
 * Void a journal entry — marks it `void` so balance queries exclude it.
 * Caller MUST already be inside a Dexie rw transaction that includes
 * journalEntries. Do not post a mirror reversal: balances only
 * sum `posted` entries, so a reversal plus void would double-apply the effect.
 */
export async function voidJournalEntryTx(entryId: string, reason: string): Promise<string> {
  const original = await db.journalEntries.get(entryId);
  if (!original) throw new Error('Journal entry not found');
  if (original.status === 'void') throw new Error('Entry already voided');

  const description = `${original.description} — Void: ${reason}`;
  await db.journalEntries.update(entryId, { status: 'void', description, updatedAt: now() });
  await bumpDashboardRevisionTx();
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
  let debit = 0;
  let credit = 0;
  await foldPostedJournalLines({ upToDate }, (accountCode, dr, cr) => {
    if (accountCode === code) {
      debit += dr;
      credit += cr;
    }
  });
  const type = typeForCode(code);
  const normalDebit = type === 'asset' || type === 'expense';
  const balance = normalDebit ? debit - credit : credit - debit;
  return { debit, credit, balance };
}

/** Balances for every account code touched, keyed by code. */
export async function getAllBalances(upToDate?: string): Promise<Map<number, AccountBalance>> {
  const debits = new Map<number, number>();
  const credits = new Map<number, number>();
  await foldPostedJournalLines({ upToDate }, (accountCode, dr, cr) => {
    debits.set(accountCode, (debits.get(accountCode) ?? 0) + dr);
    credits.set(accountCode, (credits.get(accountCode) ?? 0) + cr);
  });
  return balancesFromMaps(debits, credits);
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

/** Period activity balances (P&L) without loading the full journal into memory. */
export async function getPeriodBalances(start: string, end: string): Promise<Map<number, AccountBalance>> {
  const debits = new Map<number, number>();
  const credits = new Map<number, number>();
  await foldPostedJournalLines({ start, end }, (accountCode, dr, cr) => {
    debits.set(accountCode, (debits.get(accountCode) ?? 0) + dr);
    credits.set(accountCode, (credits.get(accountCode) ?? 0) + cr);
  });
  return balancesFromMaps(debits, credits);
}
