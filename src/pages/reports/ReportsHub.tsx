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

type ReportLink = { to: string; label: string; icon: LucideIcon };

const reportGroups: { title: string; hint: string; items: ReportLink[] }[] = [
  {
    title: 'Financial Statements',
    hint: 'Profit, net worth, and cash movement.',
    items: [
      { to: '/reports/pnl', label: 'Profit & Loss', icon: BarChart3 },
      { to: '/reports/balance-sheet', label: 'Balance Sheet', icon: Scale },
      { to: '/reports/cashflow', label: 'Cash Flow', icon: Coins },
    ],
  },
  {
    title: 'Ledger',
    hint: 'Account list and debit/credit totals.',
    items: [
      { to: '/reports/chart-of-accounts', label: 'Chart of Accounts', icon: ListTree },
      { to: '/ledger/trial-balance', label: 'Trial Balance', icon: BookOpen },
    ],
  },
  {
    title: 'Receivables & Payables',
    hint: 'Outstanding from customers and vendors.',
    items: [
      { to: '/reports/customer-aging', label: 'Customer Aging', icon: Users },
      { to: '/reports/vendor-aging', label: 'Vendor Aging', icon: Truck },
    ],
  },
  {
    title: 'Business Activity',
    hint: 'Sales, purchases, expenses, and inventory.',
    items: [
      { to: '/reports/sales', label: 'Sales Report', icon: ShoppingBag },
      { to: '/reports/purchases', label: 'Purchase Report', icon: ShoppingCart },
      { to: '/reports/expenses', label: 'Expense Report', icon: Receipt },
      { to: '/reports/inventory', label: 'Inventory Valuation', icon: Package },
    ],
  },
  {
    title: 'Analytics',
    hint: 'Trends, mix, and top performers.',
    items: [{ to: '/growth', label: 'Growth Analytics', icon: TrendingUp }],
  },
];

export default function ReportsHub() {
  return (
    <>
      <TopBar title="Reports" />
      <PageContainer>
        <div className="space-y-5">
          {reportGroups.map((group) => (
            <section key={group.title} className="space-y-2">
              <div className="px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">{group.title}</h2>
                <p className="mt-0.5 text-[11px] leading-snug text-muted">{group.hint}</p>
              </div>
              <div className="space-y-2">
                {group.items.map((r) => (
                  <Link
                    key={r.to}
                    to={r.to}
                    className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border-app bg-surface px-4 py-3 active:bg-surface-hover"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/15">
                      <r.icon className="h-5 w-5 text-brand-light" />
                    </span>
                    <p className="min-w-0 flex-1 text-sm font-medium text-foreground">{r.label}</p>
                    <ChevronRight className="h-5 w-5 text-disabled" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </PageContainer>
    </>
  );
}
