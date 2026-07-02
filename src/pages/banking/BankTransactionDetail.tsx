import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, parseISO } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, BookOpen, Calendar, ChevronRight, FileText } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EntityNotFound } from '@/components/common/EntityNotFound';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { EntityActions } from '@/components/common/EntityActions';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/common/Field';
import { JournalEntryDetailModal } from '@/pages/ledger/JournalEntryDetailModal';
import { db, type BankTransaction } from '@/lib/db';
import { getBankTxnVoidEligibility, voidBankTransaction } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

const CATEGORY_LABELS: Record<BankTransaction['category'], string> = {
  sale: 'Sale payment',
  purchase: 'Purchase payment',
  expense: 'Expense',
  transfer: 'Transfer',
  other: 'Manual entry',
};

function sourceLink(txn: BankTransaction): { to: string; label: string } | null {
  if (!txn.linkedId) return null;
  if (txn.category === 'sale') return { to: `/sales/${txn.linkedId}`, label: 'View sale' };
  if (txn.category === 'purchase') return { to: `/purchases/${txn.linkedId}`, label: 'View purchase' };
  if (txn.category === 'expense') return { to: '/expenses', label: 'Go to expenses' };
  return null;
}

export default function BankTransactionDetail() {
  const { bankId = '', txnId = '' } = useParams();
  const navigate = useNavigate();
  const [jeOpen, setJeOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voiding, setVoiding] = useState(false);

  const bank = useLiveQuery(() => db.bankAccounts.get(bankId), [bankId]);
  const txn = useLiveQuery(() => db.bankTransactions.get(txnId), [txnId]);
  const journalEntry = useLiveQuery(
    () => (txn?.journalEntryId ? db.journalEntries.get(txn.journalEntryId) : undefined),
    [txn?.journalEntryId],
  );
  const transferLegs = useLiveQuery(
    async () => {
      if (!txn || txn.category !== 'transfer') return [];
      return db.bankTransactions.filter((t) => t.reference === txn.reference).toArray();
    },
    [txn?.id, txn?.category, txn?.reference],
  );
  const voidEligibility = useLiveQuery(
    async () => (txn ? getBankTxnVoidEligibility(txn) : undefined),
    [txn?.id, txn?.reference, txn?.journalEntryId, txn?.linkedId, txn?.category],
  );

  if (bank === undefined || txn === undefined || voidEligibility === undefined) {
    return <LoadingSpinner />;
  }
  if (!bank || !txn || txn.bankAccountId !== bankId) {
    return (
      <EntityNotFound title="Transaction" backTo={`/banking/${bankId}`} backLabel="Back to account" />
    );
  }

  const isReversal = txn.reference.startsWith('VOID-');
  const formattedDate = format(parseISO(txn.date), 'd MMM yyyy');
  const linked = sourceLink(txn);
  const canVoid = voidEligibility.canVoid;

  const handleVoid = async (reason?: string) => {
    if (voiding || !reason) return;
    setVoiding(true);
    try {
      await voidBankTransaction(txn.id, reason);
      toast.success('Transaction reversed');
      setVoidOpen(false);
      navigate(`/banking/${bankId}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    } finally {
      setVoiding(false);
    }
  };

  return (
    <>
      <TopBar
        title="Transaction"
        right={
          canVoid ? (
            <EntityActions onDelete={() => setVoidOpen(true)} deleteLabel="Reverse transaction" />
          ) : undefined
        }
      />
      <PageContainer fab={false}>
        <div className="page-stack">
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="section-label">{isReversal ? 'Reversal' : CATEGORY_LABELS[txn.category]}</p>
                <MoneyDisplay
                  amount={txn.type === 'credit' ? txn.amount : -txn.amount}
                  tone={txn.type === 'credit' ? 'income' : 'expense'}
                  className="mt-1 block hero-money"
                />
              </div>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  txn.type === 'credit' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                }`}
              >
                {txn.type === 'credit' ? (
                  <ArrowDownLeft className="h-5 w-5" aria-hidden />
                ) : (
                  <ArrowUpRight className="h-5 w-5" aria-hidden />
                )}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formattedDate}
              </span>
              <span className="text-disabled">·</span>
              <span>{txn.type === 'credit' ? 'Money in' : 'Money out'}</span>
              <span className="text-disabled">·</span>
              <span>{bank.name}</span>
            </div>
          </div>

          <div className="card space-y-3">
            <div>
              <p className="text-xs text-muted">Description</p>
              <p className="mt-0.5 text-sm text-foreground">{txn.description}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Reference</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">{txn.reference}</p>
            </div>
            {journalEntry && (
              <div>
                <p className="text-xs text-muted">Journal entry</p>
                <p className="mt-0.5 text-sm text-foreground">
                  {journalEntry.reference}
                  {journalEntry.status === 'void' ? (
                    <span className="ml-2 text-xs text-danger">Voided</span>
                  ) : null}
                </p>
              </div>
            )}
          </div>

          {linked && (
            <Link
              to={linked.to}
              className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15">
                <FileText className="h-5 w-5 text-brand-light" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">Linked document</p>
                <p className="truncate text-sm font-medium text-foreground">{linked.label}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-disabled" />
            </Link>
          )}

          {txn.category === 'transfer' && (transferLegs?.length ?? 0) > 1 && (
            <div className="card">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Transfer legs</p>
              <ul className="space-y-2">
                {(transferLegs ?? []).map((leg) => {
                  const legBank = leg.bankAccountId === bank.id ? bank : null;
                  return (
                    <li
                      key={leg.id}
                      className="flex items-center justify-between gap-2 border-b border-border-app/30 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">
                          {legBank ? bank.name : 'Other account'}
                        </p>
                        <p className="text-xs text-muted">{leg.type === 'credit' ? 'Received' : 'Sent'}</p>
                      </div>
                      <MoneyDisplay
                        amount={leg.type === 'credit' ? leg.amount : -leg.amount}
                        className="text-sm font-semibold"
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {txn.journalEntryId && (
            <Button type="button" variant="secondary" className="w-full" onClick={() => setJeOpen(true)}>
              <BookOpen className="h-4 w-4" />
              View journal entry
            </Button>
          )}

          {!canVoid && voidEligibility.canVoid === false && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
              <p>{voidEligibility.message}</p>
              {voidEligibility.linkTo && voidEligibility.linkLabel ? (
                <Link to={voidEligibility.linkTo} className="mt-2 inline-block text-sm font-medium text-brand-light">
                  {voidEligibility.linkLabel}
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </PageContainer>

      <JournalEntryDetailModal
        entryId={jeOpen ? txn.journalEntryId ?? null : null}
        onClose={() => setJeOpen(false)}
      />

      <ConfirmDialog
        open={voidOpen}
        title="Reverse this transaction?"
        message="This posts a reversing bank entry and voids the linked journal entry. Use this to fix mistyped payments or manual entries."
        confirmLabel="Reverse"
        danger
        requireReason
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Wrong amount entered"
        onConfirm={handleVoid}
        onCancel={() => setVoidOpen(false)}
      />
    </>
  );
}
