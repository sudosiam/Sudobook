import { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { AppShell } from '@/components/layout/AppShell';
import { PageRouteSkeleton } from '@/components/common/PageRouteSkeleton';
import { lazyRetry } from '@/lib/lazyRetry';

const Dashboard = lazyRetry(() => import('@/pages/Dashboard'));
const SalesList = lazyRetry(() => import('@/pages/sales/SalesList'));
const NewSale = lazyRetry(() => import('@/pages/sales/NewSale'));
const SaleDetail = lazyRetry(() => import('@/pages/sales/SaleDetail'));
const PurchasesList = lazyRetry(() => import('@/pages/purchases/PurchasesList'));
const NewPurchase = lazyRetry(() => import('@/pages/purchases/NewPurchase'));
const PurchaseDetail = lazyRetry(() => import('@/pages/purchases/PurchaseDetail'));
const ExpensesList = lazyRetry(() => import('@/pages/expenses/ExpensesList'));
const NewExpense = lazyRetry(() => import('@/pages/expenses/NewExpense'));
const NewRecurringExpense = lazyRetry(() => import('@/pages/expenses/NewRecurringExpense'));
const ProductsList = lazyRetry(() => import('@/pages/inventory/ProductsList'));
const ProductCategories = lazyRetry(() => import('@/pages/inventory/ProductCategories'));
const ProductDetail = lazyRetry(() => import('@/pages/inventory/ProductDetail'));
const CustomersList = lazyRetry(() => import('@/pages/customers/CustomersList'));
const CustomerDetail = lazyRetry(() => import('@/pages/customers/CustomerDetail'));
const CustomerStatement = lazyRetry(() => import('@/pages/customers/CustomerStatement'));
const VendorsList = lazyRetry(() => import('@/pages/vendors/VendorsList'));
const VendorDetail = lazyRetry(() => import('@/pages/vendors/VendorDetail'));
const VendorStatement = lazyRetry(() => import('@/pages/vendors/VendorStatement'));
const BankingOverview = lazyRetry(() => import('@/pages/banking/BankingOverview'));
const BankDetail = lazyRetry(() => import('@/pages/banking/BankDetail'));
const GeneralLedger = lazyRetry(() => import('@/pages/ledger/GeneralLedger'));
const ChartOfAccounts = lazyRetry(() => import('@/pages/reports/ChartOfAccounts'));
const TrialBalance = lazyRetry(() => import('@/pages/ledger/TrialBalance'));
const ReportsHub = lazyRetry(() => import('@/pages/reports/ReportsHub'));
const ProfitLoss = lazyRetry(() => import('@/pages/reports/ProfitLoss'));
const BalanceSheet = lazyRetry(() => import('@/pages/reports/BalanceSheet'));
const CashFlow = lazyRetry(() => import('@/pages/reports/CashFlow'));
const CustomerAging = lazyRetry(() => import('@/pages/reports/CustomerAging'));
const VendorAging = lazyRetry(() => import('@/pages/reports/VendorAging'));
const SalesReport = lazyRetry(() => import('@/pages/reports/SalesReport'));
const PurchaseReport = lazyRetry(() => import('@/pages/reports/PurchaseReport'));
const InventoryValuation = lazyRetry(() => import('@/pages/reports/InventoryValuation'));
const ExpenseReport = lazyRetry(() => import('@/pages/reports/ExpenseReport'));
const Growth = lazyRetry(() => import('@/pages/growth/Growth'));
const Settings = lazyRetry(() => import('@/pages/settings/Settings'));
const More = lazyRetry(() => import('@/pages/more/More'));
const NewFixedAsset = lazyRetry(() => import('@/pages/more/NewFixedAsset'));
const NewLoan = lazyRetry(() => import('@/pages/more/NewLoan'));
const NewCreditCard = lazyRetry(() => import('@/pages/more/NewCreditCard'));
const NewOwnerCapital = lazyRetry(() => import('@/pages/more/NewOwnerCapital'));
const OutstandingPayments = lazyRetry(() => import('@/pages/payments/OutstandingPayments'));
const OutstandingPayables = lazyRetry(() => import('@/pages/payments/OutstandingPayables'));
const BankTransferPage = lazyRetry(() => import('@/pages/banking/BankTransferPage'));
const ManualBankEntryPage = lazyRetry(() => import('@/pages/banking/ManualBankEntryPage'));

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <Suspense fallback={<PageRouteSkeleton />}>
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
          <Route path="/more/loan" element={<NewLoan />} />
          <Route path="/more/credit-card" element={<NewCreditCard />} />
          <Route path="/more/owner-capital" element={<NewOwnerCapital />} />
          <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </MotionConfig>
  );
}
