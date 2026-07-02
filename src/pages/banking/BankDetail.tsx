import { format, parseISO } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EntityNotFound } from '@/components/common/EntityNotFound';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { EntityActions } from '@/components/common/EntityActions';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Field, Input } from '@/components/common/Field';
import { Modal } from '@/components/common/Modal';
import { BankAccountForm } from '@/components/forms/BankAccountForm';
import { db } from '@/lib/db';
import { CASH_DRAWER_ID } from '@/lib/coa';
import { updateBankAccount } from '@/lib/entities';
import { getBankBalance, getBankTransactionsWithBalance } from '@/lib/reports';
import { subtractMoney, toPaise } from '@/lib/money';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export default function BankDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [statementInput, setStatementInput] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const bank = useLiveQuery(() => db.bankAccounts.get(id), [id]);
  const txns = useLiveQuery(async () => {
    await db.bankTransactions.count();
    return getBankTransactionsWithBalance(id);
  }, [id]);
  const balance = useLiveQuery(async () => {
    await db.bankTransactions.count();
    return getBankBalance(id);
  }, [id]);

  if (bank === undefined) return <LoadingSpinner />;
  if (!bank) return <EntityNotFound title="Bank account" backTo="/banking" backLabel="Back to banking" />;

  const statementPaise = statementInput.trim() ? toPaise(statementInput) : null;
  const difference =
    statementPaise !== null && balance !== undefined
      ? subtractMoney(statementPaise, balance)
      : null;

  const canRemove = bank.isActive && bank.id !== CASH_DRAWER_ID;

  const handleDelete = async () => {
    try {
      await updateBankAccount(bank.id, { isActive: false });
      toast.success('Account removed');
      navigate('/banking');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    } finally {
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <TopBar
        title={bank.name}
        right={
          bank.isActive ? (
            <EntityActions
              onEdit={() => setEditOpen(true)}
              onDelete={canRemove ? () => setDeleteOpen(true) : undefined}
              deleteLabel="Remove account"
            />
          ) : undefined
        }
      />
      <PageContainer>
        <div className="mb-3 card">
          <p className="text-xs uppercase tracking-wider text-muted">
            {bank.bankName} · {bank.accountNumber}
          </p>
          <MoneyDisplay amount={balance ?? 0} className="mt-1 block hero-money" />
          <p className="mt-1 text-xs text-disabled">Book balance</p>
        </div>

        <div className="no-print mb-3 card">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Reconciliation</h2>
          <Field label="Bank statement balance (₹)">
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="Enter balance from bank statement"
              value={statementInput}
              onChange={(e) => setStatementInput(e.target.value)}
            />
          </Field>
          {difference !== null && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border-app bg-app px-3 py-2">
              <span className="text-xs text-muted">Difference</span>
              <MoneyDisplay
                amount={difference}
                tone={difference === 0 ? 'neutral' : 'expense'}
                className="text-sm font-semibold"
              />
            </div>
          )}
        </div>

        <h2 className="mb-2 text-base font-semibold text-foreground">Transactions</h2>
        <div className="list-shell">
          {(txns ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">No transactions yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border-app bg-app px-4 py-2 text-[10px] uppercase tracking-wider text-muted">
                <span>Description</span>
                <span className="text-right">Amount</span>
                <span className="w-[5.5rem] text-right">Balance</span>
              </div>
              {(txns ?? []).map((t) => {
                const isReversal = t.reference.startsWith('VOID-');
                return (
                  <Link
                    key={t.id}
                    to={`/banking/${id}/transactions/${t.id}`}
                    className="grid min-h-[52px] grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border-app px-3 py-2 last:border-0 active:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${isReversal ? 'text-muted' : 'text-foreground'}`}>
                        {t.description}
                      </p>
                      <p className="text-xs text-muted">
                        {t.reference} · {format(parseISO(t.date), 'd MMM yyyy')}
                      </p>
                    </div>
                    <MoneyDisplay
                      amount={t.type === 'credit' ? t.amount : -t.amount}
                      className={`text-right text-sm font-semibold ${isReversal ? 'text-muted' : ''}`}
                    />
                    <div className="flex w-[5.5rem] items-center justify-end gap-1">
                      <MoneyDisplay
                        amount={t.runningBalance}
                        className="text-right text-xs font-semibold tabular-nums"
                      />
                      <ChevronRight className="h-4 w-4 shrink-0 text-disabled" />
                    </div>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      </PageContainer>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Account">
        <BankAccountForm bank={bank} onDone={() => setEditOpen(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        title="Remove this account?"
        message="It will be hidden from banking lists. Past transactions are kept for records."
        confirmLabel="Remove"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </>
  );
}
