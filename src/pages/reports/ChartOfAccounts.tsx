import { useLiveQuery } from 'dexie-react-hooks';

import { TopBar } from '@/components/layout/TopBar';

import { PageContainer } from '@/components/layout/PageContainer';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';

import { MoneyDisplay } from '@/components/common/MoneyDisplay';

import { PeriodFilter } from '@/components/common/PeriodFilter';

import { db } from '@/lib/db';

import { getAllBalances } from '@/lib/accounting';

import { usePeriodStore, periodRange } from '@/store/usePeriodStore';



const GROUPS = [

  { type: 'asset', label: 'Assets' },

  { type: 'liability', label: 'Liabilities' },

  { type: 'equity', label: 'Equity' },

  { type: 'income', label: 'Income' },

  { type: 'expense', label: 'Expenses' },

] as const;



export default function ChartOfAccounts() {

  const { mode, year, month } = usePeriodStore();

  const range = periodRange({ mode, year, month });

  const accounts = useLiveQuery(() => db.accounts.toArray());

  const balances = useLiveQuery(async () => {

    await db.journalEntries.count();

    return getAllBalances(range?.end);

  }, [range?.end]);



  if (!accounts || !balances) return <LoadingSpinner />;



  return (

    <>

      <TopBar
        title="Chart of Accounts"
        right={<PeriodFilter placement="header" className="no-print" />}
      />

      <PageContainer>

        <p className="no-print mb-2 text-xs text-muted">
          {range
            ? `Balances as on ${new Date(range.end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : 'All time balances'}
        </p>

        <div className="page-stack">

          {GROUPS.map((g) => {

            const rows = accounts.filter((a) => a.type === g.type).sort((a, b) => a.code - b.code);

            if (rows.length === 0) return null;

            return (

              <div key={g.type}>

                <h2 className="mb-2 text-xs uppercase tracking-wider text-muted">{g.label}</h2>

                <div className="list-shell">

                  {rows.map((a) => (

                    <div key={a.id} className="flex items-center justify-between border-b border-border-app px-3 py-2 last:border-0">

                      <div>

                        <p className="text-sm text-foreground">{a.name}</p>

                        <p className="font-numeric text-xs text-muted">{a.code}</p>

                      </div>

                      <MoneyDisplay amount={balances.get(a.code)?.balance ?? 0} className="text-sm" />

                    </div>

                  ))}

                </div>

              </div>

            );

          })}

        </div>

      </PageContainer>

    </>

  );

}


