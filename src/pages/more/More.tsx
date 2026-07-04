import { Link } from 'react-router-dom';
import { useLiveQuery } from '@/hooks/useLiveQuery';
import { Building2, ChevronRight, CreditCard, Landmark, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard } from '@/components/common/StatCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { db } from '@/lib/db';
import { CODES } from '@/lib/coa';
import { getAccountBalance } from '@/lib/accounting';

type MoreAction = {
  to: string;
  title: string;
  icon: LucideIcon;
};

const ACTIONS: MoreAction[] = [
  { to: '/more/fixed-asset', title: 'Fixed Assets', icon: Building2 },
  { to: '/more/loan', title: 'Loans', icon: Landmark },
  { to: '/more/credit-card', title: 'Credit Card', icon: CreditCard },
  { to: '/more/owner-capital', title: "Owner's Capital", icon: Wallet },
];

export default function More() {
  const balances = useLiveQuery(async () => {
    await db.journalEntries.count();
    const [fixedAssets, loans, creditCards, capital] = await Promise.all([
      getAccountBalance(CODES.FIXED_ASSETS),
      getAccountBalance(CODES.LOANS),
      getAccountBalance(CODES.CREDIT_CARDS),
      getAccountBalance(CODES.CAPITAL),
    ]);
    return { fixedAssets, loans, creditCards, capital };
  });

  if (balances === undefined) return <LoadingSpinner />;

  return (
    <>
      <TopBar title="More" />
      <PageContainer>
        <div className="page-stack">
          <div>
            <p className="section-label mb-2">Balances</p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Fixed Assets" amount={balances.fixedAssets.balance} />
              <StatCard label="Loans" amount={balances.loans.balance} />
              <StatCard label="Credit Cards" amount={balances.creditCards.balance} />
              <StatCard label="Owner's Capital" amount={balances.capital.balance} />
            </div>
          </div>

          <div>
            <p className="section-label mb-2">Capital &amp; Liabilities</p>
            <div className="list-shell divide-y divide-border-app">
              {ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="flex min-h-[52px] items-center gap-2 px-4 py-3 active:bg-surface-hover"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/15">
                    <action.icon className="h-5 w-5 text-brand-light" />
                  </span>
                  <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{action.title}</p>
                  <ChevronRight className="h-5 w-5 shrink-0 text-disabled" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
