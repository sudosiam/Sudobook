import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AppShell } from '@/components/layout/AppShell';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const SalesList = lazy(() => import('@/pages/sales/SalesList'));
const NewSale = lazy(() => import('@/pages/sales/NewSale'));
const SaleDetail = lazy(() => import('@/pages/sales/SaleDetail'));
const PurchasesList = lazy(() => import('@/pages/purchases/PurchasesList'));
const NewPurchase = lazy(() => import('@/pages/purchases/NewPurchase'));
const PurchaseDetail = lazy(() => import('@/pages/purchases/PurchaseDetail'));
const ExpensesList = lazy(() => import('@/pages/expenses/ExpensesList'));
const NewExpense = lazy(() => import('@/pages/expenses/NewExpense'));
const NewRecurringExpense = lazy(() => import('@/pages/expenses/NewRecurringExpense'));
const ProductsList = lazy(() => import('@/pages/inventory/ProductsList'));
const ProductCategories = lazy(() => import('@/pages/inventory/ProductCategories'));
const ProductDetail = lazy(() => import('@/pages/inventory/ProductDetail'));
const CustomersList = lazy(() => import('@/pages/customers/CustomersList'));
const CustomerDetail = lazy(() => import('@/pages/customers/CustomerDetail'));
const CustomerStatement = lazy(() => import('@/pages/customers/CustomerStatement'));
const VendorsList = lazy(() => import('@/pages/vendors/VendorsList'));
const VendorDetail = lazy(() => import('@/pages/vendors/VendorDetail'));
const VendorStatement = lazy(() => import('@/pages/vendors/VendorStatement'));
const BankingOverview = lazy(() => import('@/pages/banking/BankingOverview'));
const BankDetail = lazy(() => import('@/pages/banking/BankDetail'));
const GeneralLedger = lazy(() => import('@/pages/ledger/GeneralLedger'));
const ChartOfAccounts = lazy(() => import('@/pages/reports/ChartOfAccounts'));
const TrialBalance = lazy(() => import('@/pages/ledger/TrialBalance'));
const ReportsHub = lazy(() => import('@/pages/reports/ReportsHub'));
const ProfitLoss = lazy(() => import('@/pages/reports/ProfitLoss'));
const BalanceSheet = lazy(() => import('@/pages/reports/BalanceSheet'));
const CashFlow = lazy(() => import('@/pages/reports/CashFlow'));
const CustomerAging = lazy(() => import('@/pages/reports/CustomerAging'));
const VendorAging = lazy(() => import('@/pages/reports/VendorAging'));
const SalesReport = lazy(() => import('@/pages/reports/SalesReport'));
const PurchaseReport = lazy(() => import('@/pages/reports/PurchaseReport'));
const InventoryValuation = lazy(() => import('@/pages/reports/InventoryValuation'));
const ExpenseReport = lazy(() => import('@/pages/reports/ExpenseReport'));
const Growth = lazy(() => import('@/pages/growth/Growth'));
const Settings = lazy(() => import('@/pages/settings/Settings'));
const More = lazy(() => import('@/pages/more/More'));
const NewFixedAsset = lazy(() => import('@/pages/more/NewFixedAsset'));
const OutstandingPayments = lazy(() => import('@/pages/payments/OutstandingPayments'));
const OutstandingPayables = lazy(() => import('@/pages/payments/OutstandingPayables'));
const BankTransferPage = lazy(() => import('@/pages/banking/BankTransferPage'));
const ManualBankEntryPage = lazy(() => import('@/pages/banking/ManualBankEntryPage'));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<LoadingSpinner className="mt-20" />}>
        <Routes>
          <Route element={<AppShell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sales" element={<SalesList />} />
          <Route path="/sales/new" element={<NewSale />} />
          <Route path="/sales/:id" element={<SaleDetail />} />
          <Route path="/purchases" element={<PurchasesList />} />
          <Route path="/purchases/new" element={<NewPurchase />} />
          <Route path="/purchases/:id" element={<PurchaseDetail />} />
          <Route path="/expenses" element={<ExpensesList />} />
          <Route path="/expenses/new" element={<NewExpense />} />
          <Route path="/expenses/recurring/new" element={<NewRecurringExpense />} />
          <Route path="/inventory" element={<ProductsList />} />
          <Route path="/inventory/categories" element={<ProductCategories />} />
          <Route path="/inventory/:id" element={<ProductDetail />} />
          <Route path="/customers" element={<CustomersList />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/customers/:id/statement" element={<CustomerStatement />} />
          <Route path="/vendors" element={<VendorsList />} />
          <Route path="/vendors/:id" element={<VendorDetail />} />
          <Route path="/vendors/:id/statement" element={<VendorStatement />} />
          <Route path="/banking" element={<BankingOverview />} />
          <Route path="/banking/transfer" element={<BankTransferPage />} />
          <Route path="/banking/manual-entry" element={<ManualBankEntryPage />} />
          <Route path="/banking/:id" element={<BankDetail />} />
          <Route path="/ledger" element={<GeneralLedger />} />
          <Route path="/reports/chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="/ledger/accounts" element={<ChartOfAccounts />} />
          <Route path="/ledger/trial-balance" element={<TrialBalance />} />
          <Route path="/reports" element={<ReportsHub />} />
          <Route path="/reports/pnl" element={<ProfitLoss />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
          <Route path="/reports/cashflow" element={<CashFlow />} />
          <Route path="/reports/customer-aging" element={<CustomerAging />} />
          <Route path="/reports/vendor-aging" element={<VendorAging />} />
          <Route path="/reports/sales" element={<SalesReport />} />
          <Route path="/reports/purchases" element={<PurchaseReport />} />
          <Route path="/reports/inventory" element={<InventoryValuation />} />
          <Route path="/reports/expenses" element={<ExpenseReport />} />
          <Route path="/growth" element={<Growth />} />
          <Route path="/payments" element={<OutstandingPayments />} />
          <Route path="/payments/payable" element={<OutstandingPayables />} />
          <Route path="/more" element={<More />} />
          <Route path="/more/fixed-asset" element={<NewFixedAsset />} />
          <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </MotionConfig>
  );
}
