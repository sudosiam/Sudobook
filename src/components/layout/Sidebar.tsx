import {
  BarChart2,
  Banknote,
  BookOpen,
  HandCoins,
  Home,
  LayoutGrid,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';
import { db } from '@/lib/db';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';
import { backdropVariants, springSnappy } from '@/lib/motion';

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  badgeKey?: 'inventory';
};

type NavCategory = {
  title: string;
  items: NavItem[];
};

const navCategories: NavCategory[] = [
  {
    title: 'Overview',
    items: [{ to: '/', label: 'Dashboard', icon: Home, end: true }],
  },
  {
    title: 'Sales',
    items: [
      { to: '/sales', label: 'Sales', icon: ShoppingBag },
      { to: '/customers', label: 'Customers', icon: Users },
      { to: '/payments', label: 'Payments', icon: HandCoins },
    ],
  },
  {
    title: 'Purchases',
    items: [
      { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
      { to: '/vendors', label: 'Vendors', icon: Truck },
      { to: '/payments/payable', label: 'Pay Vendors', icon: Banknote },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/inventory', label: 'Inventory', icon: Package, badgeKey: 'inventory' },
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/banking', label: 'Banking', icon: Wallet },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { to: '/ledger', label: 'Ledger', icon: BookOpen },
      { to: '/reports', label: 'Reports', icon: BarChart2 },
      { to: '/growth', label: 'Growth', icon: TrendingUp },
    ],
  },
  {
    title: 'App',
    items: [
      { to: '/more', label: 'More', icon: LayoutGrid },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function NavSection({
  title,
  items,
  lowStockCount,
}: {
  title: string;
  items: NavItem[];
  lowStockCount?: number;
}) {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);

  return (
    <div>
      <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wide text-disabled">{title}</p>
      <ul className="space-y-px">
        {items.map((item) => {
          const badge =
            item.badgeKey === 'inventory' && lowStockCount !== undefined && lowStockCount > 0
              ? lowStockCount
              : null;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-[48px] items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-colors active:bg-surface-hover',
                    isActive
                      ? 'border-l-[3px] border-brand-light bg-brand/15 pl-2 text-brand-light'
                      : 'border-l-[3px] border-transparent text-muted hover:bg-surface-hover hover:text-foreground',
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
                {badge !== null && (
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-warning px-1 text-[10px] font-bold text-app">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const location = useLocation();
  const isMobile = useIsMobile();
  const asideRef = useRef<HTMLElement>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);
  const trapActive = isMobile && sidebarOpen;
  useFocusTrap(trapActive, asideRef, closeSidebar);

  const lowStockCount = useLiveQuery(
    () => db.products.filter((p) => p.isActive && p.stockQty <= p.minStock).count(),
    [],
  );
  const settings = useLiveQuery(() => db.settings.get('singleton'), []);
  const businessName = settings?.businessName?.trim() ?? '';

  useEffect(() => {
    if (!trapActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trapActive, closeSidebar]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname, setSidebarOpen]);

  return (
    <>
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.button
            type="button"
            aria-label="Close menu"
            className="no-print fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
          />
        )}
      </AnimatePresence>

      <motion.aside
        ref={asideRef}
        role={trapActive ? 'dialog' : undefined}
        aria-modal={trapActive ? true : undefined}
        aria-label={trapActive ? 'Main navigation' : undefined}
        initial={false}
        animate={{ x: isMobile ? (sidebarOpen ? 0 : '-100%') : 0 }}
        transition={springSnappy}
        style={{ willChange: 'transform' }}
        className="no-print fixed inset-y-0 left-0 z-[60] flex w-[15.5rem] flex-col border-r border-border-app/40 bg-app pt-safe shadow-xl md:static md:z-auto md:w-56 md:shadow-none"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-app/40 px-3">
          <div>
            <p className="text-[15px] font-bold tracking-tight text-foreground">Sudo Books</p>
            {businessName ? (
              <p className="truncate text-xs text-muted">{businessName}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="icon-btn md:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-1.5 py-2">
          <div className="page-stack">
            {navCategories.map((category) => (
              <NavSection
                key={category.title}
                title={category.title}
                items={category.items}
                lowStockCount={lowStockCount}
              />
            ))}
          </div>
        </nav>
      </motion.aside>
    </>
  );
}
