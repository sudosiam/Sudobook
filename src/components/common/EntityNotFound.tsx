import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/common/EmptyState';

export function EntityNotFound({
  title,
  backTo,
  backLabel,
}: {
  title: string;
  backTo: string;
  backLabel: string;
}) {
  return (
    <>
      <TopBar title={title} />
      <PageContainer>
        <EmptyState
          icon={FileQuestion}
          title={`${title} not found`}
          action={
            <Link to={backTo} className="text-sm font-medium text-brand-light">
              {backLabel}
            </Link>
          }
        />
      </PageContainer>
    </>
  );
}
