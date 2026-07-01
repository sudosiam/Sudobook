import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Account } from '@/lib/db';
import {
  isSelectableExpenseAccount,
  isSelectableIncomeAccount,
  sortAccountsByCode,
} from '@/lib/coa';

function querySelectable(filter: (a: Account) => boolean): Promise<Account[]> {
  return db.accounts.toArray().then((all) => sortAccountsByCode(all.filter(filter)));
}

/** Active expense accounts for manual expense forms (502–599, excludes COGS). */
export function useSelectableExpenseAccounts(): Account[] | undefined {
  return useLiveQuery(() => querySelectable(isSelectableExpenseAccount), []);
}

/** Active income accounts for recording other income (400–499). */
export function useSelectableIncomeAccounts(): Account[] | undefined {
  return useLiveQuery(() => querySelectable(isSelectableIncomeAccount), []);
}
