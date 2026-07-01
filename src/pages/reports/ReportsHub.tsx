import { Link } from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Coins,
  ListTree,
  Package,
  Receipt,
  Scale,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { PageContainer } from '@/components/layout/PageContainer';

const reports: { to: string; label: string; desc: string; icon: LucideIcon }[] = [
  { to: '/reports/pnl', label: 'Profit & Loss', desc: 'Income, COGS and expenses', icon: BarChart3 },
  { to: '/reports/balance-sheet', label: 'Balance Sheet', desc: 'Assets, liabilities & equity', icon: Scale },
  { to: '/reports/cashflow', label: 'Cash Flow', desc: 'Operating, investing, financing', icon: Coins },
  { to: '/reports/chart-of-accounts', label: 'Chart of Accounts', desc: 'All accounts and current balances', icon: ListTree },
  { to: '/ledger/trial-balance', label: 'Trial Balance', desc: 'All account debits & credits', icon: BookOpen },
  { to: '/reports/customer-aging', label: 'Customer Aging', desc: 'Receivables by overdue bucket', icon: Users },
  { to: '/reports/vendor-aging', label: 'Vendor Aging', desc: 'Payables by overdue bucket', icon: Truck },
  { to: '/reports/sales', label: 'Sales Report', desc: 'By product, customer & payment', icon: ShoppingBag },
  { to: '/reports/purchases', label: 'Purchase Report', desc: 'By product, vendor & payment', icon: ShoppingCart },
  { to: '/reports/inventory', label: 'Inventory Valuation', desc: 'Stock value at cost & retail', icon: Package },
  { to: '/reports/expenses', label: 'Expense Report', desc: 'By category for the period', icon: Receipt },
  { to: '/growth', label: 'Growth Analytics', desc: 'Trends and top performers', icon: TrendingUp },
];

export default function ReportsHub() {
  return (
    <>
      <TopBar title="Reports" />
      <PageContainer>
        <div className="space-y-2">
          {reports.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15">
                <r.icon className="h-5 w-5 text-brand-light" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-muted">{r.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-disabled" />
            </Link>
          ))}
        </div>
      </PageContainer>
    </>
  );
}
