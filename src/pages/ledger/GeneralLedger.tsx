import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { SearchBar } from '@/components/common/SearchBar';
import { EmptyState } from '@/components/common/EmptyState';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { db, type JournalEntry } from '@/lib/db';
import { typeForCode } from '@/lib/coa';
import { PeriodFilter } from '@/components/common/PeriodFilter';
import { usePeriodStore, periodRange } from '@/store/usePeriodStore';
import { JournalEntryDetailModal } from '@/pages/ledger/JournalEntryDetailModal';

interface LedgerRow {
  key: string;
  entryId: string;
  lineIndex: number;
  date: string;
  reference: string;
  description: string;
  accountCode: number;
  debit: number; // paise
  credit: number; // paise
  runningBalance: number; // paise
  isVoid: boolean;
}

function buildLedgerRows(entries: JournalEntry[]): LedgerRow[] {
  const flat = entries.flatMap((e) =>
    e.lines.map((l, i) => ({
      ...l,
      entryId: e.id,
      date: e.date,
      reference: e.reference,
      description: e.description,
      status: e.status,
      createdAt: e.createdAt,
      lineIndex: i,
    })),
  );

  const sorted = [...flat].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    const byCreated = a.createdAt.localeCompare(b.createdAt);
    if (byCreated !== 0) return byCreated;
    return a.lineIndex - b.lineIndex;
  });

  const accountBalances = new Map<number, number>();

  const withBalance = sorted.map((line) => {
    let runningBalance = accountBalances.get(line.accountCode) ?? 0;

    if (line.status === 'posted') {
      const type = typeForCode(line.accountCode);
      const normalDebit = type === 'asset' || type === 'expense';
      const delta = normalDebit ? line.debit - line.credit : line.credit - line.debit;
      runningBalance += delta;
      accountBalances.set(line.accountCode, runningBalance);
    }

    return {
      key: `${line.entryId}-${line.lineIndex}`,
      entryId: line.entryId,
      lineIndex: line.lineIndex,
      date: line.date,
      reference: line.reference,
      description: line.description,
      accountCode: line.accountCode,
      debit: line.debit,
      credit: line.credit,
      runningBalance,
      isVoid: line.status === 'void',
    };
  });

  return withBalance.reverse();
}

const COLS = 'grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_4.5rem] gap-1 sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_5.5rem] sm:gap-2';

function AmountCell({ amount }: { amount: number }) {
  return (
    <span className="text-right">
      {amount > 0 ? (
        <MoneyDisplay amount={amount} className="text-[11px] sm:text-xs" />
      ) : (
        <span className="text-[11px] text-disabled sm:text-xs">—</span>
      )}
    </span>
  );
}

const PAGE_SIZE = 200;

export default function GeneralLedger() {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<{ entryId: string; lineIndex: number } | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { mode, year, month } = usePeriodStore();
  const range = periodRange({ mode, year, month });
  const entries = useLiveQuery(
    () =>
      range
        ? db.journalEntries
            .where('date')
            .between(range.start, range.end, true, true)
            .reverse()
            .toArray()
        : db.journalEntries.orderBy('date').reverse().limit(limit).toArray(),
    [range?.start, range?.end, limit],
  );

  const rows = useMemo(() => buildLedgerRows(entries ?? []), [entries]);

  const filtered = rows.filter((r) => {
    const needle = q.toLowerCase();
    return (
      r.description.toLowerCase().includes(needle) ||
      r.reference.toLowerCase().includes(needle) ||
      String(r.accountCode).includes(needle)
    );
  });

  return (
    <>
      <TopBar
        title="General Ledger"
        right={
          <div className="flex items-center gap-1.5">
            <PeriodFilter placement="header" />
            <div className="hidden gap-2 text-xs sm:flex">
              <Link to="/reports/chart-of-accounts" className="text-brand-light">
                Accounts
              </Link>
              <Link to="/ledger/trial-balance" className="text-brand-light">
                Trial Bal.
              </Link>
            </div>
          </div>
        }
      />
      <PageContainer>
        <div className="filter-toolbar">
          <SearchBar value={q} onChange={setQ} placeholder="Search entries…" />
        </div>
        {!entries ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={(entries?.length ?? 0) === 0 ? 'No journal entries' : 'No matching entries'}
          />
        ) : (
          <div className="list-shell">
            <div
              className={`${COLS} border-b border-border-app bg-app px-3 py-2 text-[10px] uppercase tracking-wider text-muted sm:px-4`}
            >
              <span>Particulars</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
              <span className="text-right">Balance</span>
            </div>
            {filtered.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelected({ entryId: r.entryId, lineIndex: r.lineIndex })}
                className={`${COLS} min-h-[48px] w-full border-b border-border-app px-2 py-2 text-left last:border-0 active:bg-surface-hover sm:px-3 ${r.isVoid ? 'opacity-50' : ''}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground sm:text-sm">
                    {r.description}
                  </p>
                  <p className="truncate text-[10px] text-muted sm:text-xs">
                    <span className="font-numeric">{r.accountCode}</span>
                    {' · '}
                    {r.reference}
                    {' · '}
                    {r.date}
                    {r.isVoid && ' · VOID'}
                  </p>
                </div>
                <AmountCell amount={r.debit} />
                <AmountCell amount={r.credit} />
                <MoneyDisplay
                  amount={r.runningBalance}
                  className="text-right text-[11px] font-semibold sm:text-xs"
                />
              </button>
            ))}
            {!range && (entries?.length ?? 0) >= limit && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
                className="w-full min-h-[48px] border-t border-border-app/35 py-3 text-sm font-medium text-brand-light active:bg-surface-hover"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </PageContainer>

      <JournalEntryDetailModal
        entryId={selected?.entryId ?? null}
        highlightLineIndex={selected?.lineIndex}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
