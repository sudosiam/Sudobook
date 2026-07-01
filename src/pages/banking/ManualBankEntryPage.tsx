import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { ManualBankEntryForm } from '@/pages/banking/ManualBankEntry';

export default function ManualBankEntryPage() {
  const navigate = useNavigate();

  return (
    <>
      <TopBar title="Manual Bank Entry" />
      <PageContainer>
        <ManualBankEntryForm onDone={() => navigate('/banking')} />
      </PageContainer>
    </>
  );
}
