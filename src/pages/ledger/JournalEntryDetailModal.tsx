import { Link } from 'react-router-dom';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { ExternalLink } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { addMoney } from '@/lib/money';
import { db, type EntryType, type JournalEntry } from '@/lib/db';

const ENTRY_LABELS: Record<EntryType, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  expense: 'Expense',
  payment: 'Payment',
  receipt: 'Receipt',
  transfer: 'Transfer',
  adjustment: 'Adjustment',
  opening: 'Opening Balance',
};

function sourceLink(entry: JournalEntry): string | null {
  if (!entry.linkedId) return null;
  if (entry.entryType === 'sale' || entry.entryType === 'receipt') {
    return `/sales/${entry.linkedId}`;
  }
  if (entry.entryType === 'purchase' || entry.entryType === 'payment') {
    return `/purchases/${entry.linkedId}`;
  }
  if (entry.entryType === 'expense') return `/expenses`;
  return null;
}

function AmountCell({ amount }: { amount: number }) {
  return (
    <span className="text-right">
      {amount > 0 ? (
        <MoneyDisplay amount={amount} className="text-xs" />
      ) : (
        <span className="text-xs text-disabled">—</span>
      )}
    </span>
  );
}

interface JournalEntryDetailModalProps {
  entryId: string | null;
  highlightLineIndex?: number;
  onClose: () => void;
}

export function JournalEntryDetailModal({
  entryId,
  highlightLineIndex,
  onClose,
}: JournalEntryDetailModalProps) {
  const entry = useLiveQuery(() => (entryId ? db.journalEntries.get(entryId) : undefined), [entryId]);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const linkedExpense = useLiveQuery(
    () =>
      entry?.entryType === 'expense' && entry.linkedId
        ? db.expenses.get(entry.linkedId)
        : undefined,
    [entry?.entryType, entry?.linkedId],
  );

  const accountName = (code: number) =>
    accounts?.find((a) => a.code === code)?.name ?? `Account ${code}`;

  const link = entry ? sourceLink(entry) : null;
  const totalDebit = entry ? addMoney(...entry.lines.map((l) => l.debit)) : 0;
  const totalCredit = entry ? addMoney(...entry.lines.map((l) => l.credit)) : 0;

  return (
    <Modal open={entryId !== null} onClose={onClose} title={entry?.reference ?? 'Journal Entry'}>
      {entry === undefined ? (
        <LoadingSpinner className="py-8" />
      ) : !entry ? (
        <p className="py-4 text-center text-sm text-muted">Entry not found.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-base font-semibold text-foreground">{entry.description}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  entry.status === 'void'
                    ? 'bg-danger/15 text-danger'
                    : 'bg-success/15 text-success'
                }`}
              >
                {entry.status === 'void' ? 'Void' : 'Posted'}
              </span>
              <span className="rounded-full bg-brand-light/15 px-2 py-0.5 text-[10px] font-semibold text-brand-light">
                {ENTRY_LABELS[entry.entryType]}
              </span>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Date</dt>
              <dd className="font-medium text-foreground">{entry.date}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Reference</dt>
              <dd className="font-numeric font-medium text-foreground">{entry.reference}</dd>
            </div>
            {entry.reversalOf && (
              <div className="col-span-2">
                <dt className="text-xs text-muted">Reversal of</dt>
                <dd className="font-numeric text-xs text-muted">{entry.reversalOf}</dd>
              </div>
            )}
          </dl>

          <div className="overflow-hidden rounded-xl border border-border-app">
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 border-b border-border-app bg-app px-3 py-2 text-[10px] uppercase tracking-wider text-muted">
              <span>Account</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
            </div>
            {entry.lines.map((line, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 border-b border-border-app px-3 py-2 last:border-0 ${
                  highlightLineIndex === i ? 'bg-brand/10' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{accountName(line.accountCode)}</p>
                  <p className="font-numeric text-xs text-muted">{line.accountCode}</p>
                  {line.note && <p className="mt-0.5 text-xs text-muted">{line.note}</p>}
                </div>
                <AmountCell amount={line.debit} />
                <AmountCell amount={line.credit} />
              </div>
            ))}
            <div className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 bg-app px-3 py-2 font-semibold">
              <span className="text-xs text-foreground">Total</span>
              <MoneyDisplay amount={totalDebit} className="text-right text-xs" />
              <MoneyDisplay amount={totalCredit} className="text-right text-xs" />
            </div>
          </div>

          {linkedExpense && (
            <div className="rounded-xl border border-border-app bg-app px-3 py-2 text-sm">
              <p className="text-xs text-muted">Linked expense</p>
              <p className="font-medium text-foreground">{linkedExpense.description}</p>
              <MoneyDisplay amount={linkedExpense.amount} className="mt-1 text-sm" tone="expense" />
            </div>
          )}

          {link && (
            <Link
              to={link}
              onClick={onClose}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border-app bg-surface text-sm font-medium text-brand-light active:bg-surface-hover"
            >
              View source document
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}

          <p className="text-center text-[10px] text-disabled">
            Posted {new Date(entry.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
      )}
    </Modal>
  );
}
