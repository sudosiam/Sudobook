import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { BankTransferForm } from '@/pages/banking/BankTransfer';

export default function BankTransferPage() {
  const navigate = useNavigate();

  return (
    <>
      <TopBar title="Transfer Funds" />
      <PageContainer>
        <BankTransferForm onDone={() => navigate('/banking')} />
      </PageContainer>
    </>
  );
}
