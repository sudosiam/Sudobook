import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { Button, Field, FormDateInput, Input, Select } from '@/components/common/Field';
import { MoneyInput } from '@/components/common/MoneyInput';
import { AccountCategorySelect } from '@/components/common/AccountCategorySelect';
import { db, activeWhere } from '@/lib/db';
import { CASH_DRAWER_ID, CODES } from '@/lib/coa';
import {
  bankEntryReasonsForType,
  defaultReasonForType,
  getBankEntryReason,
  reasonAllowsCategoryOverride,
  type BankEntryReasonId,
} from '@/lib/bankEntryReasons';
import {
  useSelectableExpenseAccounts,
  useSelectableIncomeAccounts,
} from '@/hooks/useAccountCategories';
import { manualBankEntrySchema, type ManualBankEntryFormData } from '@/lib/validators';
import { recordManualBankEntry, transferBetweenBanks } from '@/lib/transactions';
import { getErrorMessage } from '@/lib/errors';
import { toast } from '@/store/useToast';

export function ManualBankEntryForm({ onDone }: { onDone: () => void }) {
  const banks = useLiveQuery(() => activeWhere(db.bankAccounts).toArray());
  const expenseAccounts = useSelectableExpenseAccounts();
  const incomeAccounts = useSelectableIncomeAccounts();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ManualBankEntryFormData>({
    resolver: zodResolver(manualBankEntrySchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      bankAccountId: '',
      type: 'deposit',
      reason: 'cash_deposit',
      counterpartyBankId: CASH_DRAWER_ID,
      amount: 0,
      accountCode: CODES.OTHER_INCOME,
      description: '',
    },
  });

  const entryType = watch('type');
  const reasonId = watch('reason') as BankEntryReasonId;
  const accountCode = watch('accountCode');
  const bankAccountId = watch('bankAccountId');
  const counterpartyBankId = watch('counterpartyBankId');

  const reasonConfig = getBankEntryReason(reasonId);
  const isTransfer = reasonConfig.subType === 'transfer';
  const categoryAccounts = entryType === 'deposit' ? incomeAccounts : expenseAccounts;
  const showCategoryPicker =
    !isTransfer && reasonAllowsCategoryOverride(reasonId);

  useEffect(() => {
    const valid = bankEntryReasonsForType(entryType).some((r) => r.id === reasonId);
    if (!valid) {
      const next = defaultReasonForType(entryType);
      setValue('reason', next);
      const cfg = getBankEntryReason(next);
      if (cfg.accountCode != null) setValue('accountCode', cfg.accountCode);
    }
  }, [entryType, reasonId, setValue]);

  useEffect(() => {
    const cfg = getBankEntryReason(reasonId);
    if (cfg.accountCode != null && !reasonAllowsCategoryOverride(reasonId)) {
      setValue('accountCode', cfg.accountCode);
    }
  }, [reasonId, setValue]);

  useEffect(() => {
    if (!showCategoryPicker || !categoryAccounts?.length) return;
    const valid = categoryAccounts.some((a) => a.code === accountCode);
    if (!valid) setValue('accountCode', categoryAccounts[0].code);
  }, [categoryAccounts, accountCode, showCategoryPicker, setValue]);

  useEffect(() => {
    if (!isTransfer || !banks?.length) return;
    if (counterpartyBankId && counterpartyBankId === bankAccountId) {
      const fallback = banks.find((b) => b.id === CASH_DRAWER_ID && b.id !== bankAccountId);
      setValue('counterpartyBankId', fallback?.id ?? '');
    } else if (
      entryType === 'deposit' &&
      reasonId === 'cash_deposit' &&
      !counterpartyBankId &&
      banks.some((b) => b.id === CASH_DRAWER_ID)
    ) {
      setValue('counterpartyBankId', CASH_DRAWER_ID);
    }
  }, [banks, entryType, isTransfer, reasonId, bankAccountId, counterpartyBankId, setValue]);

  const counterpartyOptions = (banks ?? []).filter((b) => b.id !== bankAccountId);
  const reasonOptions = bankEntryReasonsForType(entryType);

  const onSubmit = async (data: ManualBankEntryFormData) => {
    try {
      const cfg = getBankEntryReason(data.reason);

      if (cfg.subType === 'transfer') {
        const fromId =
          data.type === 'deposit' ? data.counterpartyBankId! : data.bankAccountId;
        const toId = data.type === 'deposit' ? data.bankAccountId : data.counterpartyBankId!;
        await transferBetweenBanks({
          date: data.date,
          fromBankId: fromId,
          toBankId: toId,
          amount: data.amount,
          note: data.description,
        });
        toast.success(data.type === 'deposit' ? 'Deposit recorded' : 'Withdrawal recorded');
      } else {
        const code = reasonAllowsCategoryOverride(data.reason)
          ? data.accountCode!
          : cfg.accountCode!;
        await recordManualBankEntry({
          date: data.date,
          bankAccountId: data.bankAccountId,
          type: data.type,
          amount: data.amount,
          description: data.description,
          accountCode: code,
        });
        toast.success(data.type === 'deposit' ? 'Income recorded' : 'Expense recorded');
      }
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed'));
    }
  };

  const canSubmit =
    !isSubmitting &&
    (isTransfer ? (banks?.length ?? 0) >= 2 : !!categoryAccounts?.length);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
      <Field label="Type" error={errors.type?.message}>
        <Select
          {...register('type', {
            onChange: (e) => {
              const nextType = e.target.value as 'deposit' | 'withdrawal';
              setValue('type', nextType);
              const nextReason = defaultReasonForType(nextType);
              setValue('reason', nextReason);
              const cfg = getBankEntryReason(nextReason);
              if (cfg.accountCode != null) setValue('accountCode', cfg.accountCode);
            },
          })}
        >
          <option value="deposit">Deposit (money in)</option>
          <option value="withdrawal">Withdrawal (money out)</option>
        </Select>
      </Field>

      <Field label="Reason" error={errors.reason?.message}>
        <Select {...register('reason')}>
          {reasonOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Date" error={errors.date?.message}>
        <FormDateInput name="date" control={control} />
      </Field>

      {isTransfer ? (
        <>
          <Field
            label={entryType === 'deposit' ? 'To (account)' : 'From (account)'}
            error={errors.bankAccountId?.message}
          >
            <Select {...register('bankAccountId')}>
              <option value="">Select account</option>
              {(banks ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.accountType === 'cash' ? ' (cash)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={entryType === 'deposit' ? 'From (other account)' : 'To (other account)'}
            error={errors.counterpartyBankId?.message}
          >
            <Select {...register('counterpartyBankId')}>
              <option value="">Select account</option>
              {counterpartyOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.accountType === 'cash' ? ' (cash)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <Field label="Bank Account" error={errors.bankAccountId?.message}>
          <Select {...register('bankAccountId')}>
            <option value="">Select account</option>
            {(banks ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {isTransfer && (banks?.length ?? 0) < 2 && (
        <p className="text-xs text-warning">
          Add another bank or cash account (Banking → Account) to transfer between accounts.
        </p>
      )}

      <Field label="Amount" error={errors.amount?.message}>
        <MoneyInput value={watch('amount')} onChange={(v) => setValue('amount', v)} />
      </Field>

      {showCategoryPicker && (
        <Field
          label={entryType === 'deposit' ? 'Income Category' : 'Expense Category'}
          error={errors.accountCode?.message}
        >
          <AccountCategorySelect
            accounts={categoryAccounts}
            value={accountCode}
            onChange={(code) => setValue('accountCode', code)}
            emptyLabel={
              entryType === 'deposit' ? 'No income accounts' : 'No expense accounts'
            }
          />
        </Field>
      )}

      <Field label="Description" error={errors.description?.message}>
        <Input
          {...register('description')}
          placeholder={reasonConfig.descriptionPlaceholder}
        />
      </Field>

      <Button type="submit" disabled={!canSubmit} className="w-full">
        Record Entry
      </Button>
    </form>
  );
}
