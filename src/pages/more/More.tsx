import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Building2, ChevronRight } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { StatCard } from '@/components/common/StatCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { db } from '@/lib/db';
import { CODES } from '@/lib/coa';
import { getAccountBalance } from '@/lib/accounting';

export default function More() {
  const fixedAssets = useLiveQuery(async () => {
    await db.journalEntries.count();
    return getAccountBalance(CODES.FIXED_ASSETS);
  });

  if (fixedAssets === undefined) return <LoadingSpinner />;

  return (
    <>
      <TopBar title="More" />
      <PageContainer>
        <div className="page-stack">
          <StatCard label="Fixed Assets" amount={fixedAssets.balance} />

          <div>
            <p className="section-label mb-2">Actions</p>
            <Link
              to="/more/fixed-asset"
              className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15">
                <Building2 className="h-5 w-5 text-brand-light" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Record Fixed Asset</p>
                <p className="text-xs text-muted">Equipment, furniture, fixtures — capital purchases</p>
              </div>
              <ChevronRight className="h-5 w-5 text-disabled" />
            </Link>
          </div>
        </div>
      </PageContainer>
    </>
  );
}
