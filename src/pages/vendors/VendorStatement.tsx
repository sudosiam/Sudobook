import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format } from 'date-fns';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EntityNotFound } from '@/components/common/EntityNotFound';
import { MoneyDisplay } from '@/components/common/MoneyDisplay';
import { PrintIconButton } from '@/components/common/PrintButton';
import { db } from '@/lib/db';
import { getVendorBalance } from '@/lib/reports';
import { useSettings } from '@/hooks/useSettings';
import { toINR } from '@/lib/money';

export default function VendorStatement() {
  const { id = '' } = useParams();
  const settings = useSettings();
  const vendor = useLiveQuery(() => db.vendors.get(id), [id]);
  const purchases = useLiveQuery(
    () => db.purchases.where('vendorId').equals(id).reverse().sortBy('date'),
    [id],
  );
  const balance = useLiveQuery(async () => {
    await db.purchases.count();
    return getVendorBalance(id);
  }, [id]);

  if (vendor === undefined || !settings) return <LoadingSpinner />;
  if (!vendor) return <EntityNotFound title="Vendor" backTo="/vendors" backLabel="Back to vendors" />;

  const asOf = format(new Date(), 'dd MMM yyyy');
  const activePurchases = (purchases ?? []).filter((p) => p.status !== 'void');

  return (
    <>
      <TopBar title="Vendor Statement" right={<PrintIconButton />} />
      <PageContainer className="print-page">
        <div className="print-area mb-3 page-stack">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground print:text-black">{settings.businessName}</p>
            <p className="text-sm text-muted print:text-gray-600">Vendor Statement</p>
            <p className="mt-1 text-xs text-disabled print:text-gray-500">As on {asOf}</p>
          </div>

          <div className="card print:border-gray-300 print:bg-white">
            <p className="font-semibold text-foreground print:text-black">{vendor.name}</p>
            <p className="text-sm text-muted print:text-gray-600">{vendor.phone}</p>
            {vendor.company && (
              <p className="text-sm text-muted print:text-gray-600">{vendor.company}</p>
            )}
          </div>

          {vendor.openingBalance > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted print:text-gray-600">Opening Balance</span>
              <span className="font-numeric tabular-nums">{toINR(vendor.openingBalance)}</span>
            </div>
          )}

          <div className="overflow-x-auto scroll-touch">
            <table className="w-full min-w-[32rem] text-sm">
            <thead>
              <tr className="border-b border-border-app text-left text-xs uppercase tracking-wider text-muted print:border-gray-300 print:text-gray-600">
                <th className="py-2">Date</th>
                <th className="py-2">Reference</th>
                <th className="py-2 text-right">Total</th>
                <th className="py-2 text-right">Paid</th>
                <th className="py-2 text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {activePurchases.map((p) => (
                <tr key={p.id} className="border-b border-border-app print:border-gray-200">
                  <td className="py-2 text-foreground print:text-black">{p.date}</td>
                  <td className="py-2 text-muted print:text-gray-700">{p.purchaseNumber}</td>
                  <td className="py-2 text-right font-numeric tabular-nums">{toINR(p.total)}</td>
                  <td className="py-2 text-right font-numeric tabular-nums">{toINR(p.paidAmount)}</td>
                  <td className="py-2 text-right font-numeric tabular-nums">{toINR(p.dueAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="flex items-center justify-between border-t border-border-app pt-4 print:border-gray-400">
            <span className="font-semibold text-foreground print:text-black">Outstanding Payable</span>
            <MoneyDisplay amount={balance ?? 0} tone="expense" className="text-lg font-bold" />
          </div>
        </div>

        <Link to={`/vendors/${id}`} className="no-print mt-3 block text-center text-sm text-brand-light">
          Back to vendor
        </Link>
      </PageContainer>
    </>
  );
}
