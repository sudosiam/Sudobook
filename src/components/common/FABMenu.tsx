import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FABMenuItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  state?: Record<string, boolean>;
};

export const dashboardAddItems: FABMenuItem[] = [
  { to: '/sales/new', label: 'Sale', icon: ShoppingBag },
  { to: '/purchases/new', label: 'Purchase', icon: ShoppingCart },
  { to: '/expenses/new', label: 'Expense', icon: Receipt },
  { to: '/customers', label: 'Customer', icon: Users, state: { openNew: true } },
  { to: '/inventory', label: 'Product', icon: Package, state: { openNew: true } },
];

export function FABMenu({ items }: { items: FABMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleSelect = (item: FABMenuItem) => {
    setOpen(false);
    navigate(item.to, item.state ? { state: item.state } : undefined);
  };

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close add menu"
          className="no-print fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="no-print fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-3 z-40 flex flex-col items-end gap-2">
        {open &&
          items.map((item) => (
            <button
              key={`${item.to}-${item.label}`}
              type="button"
              onClick={() => handleSelect(item)}
              className="flex min-h-[48px] items-center gap-2 active:scale-95"
            >
              <span className="rounded-xl border border-border-app/40 bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md">
                {item.label}
              </span>
              <span className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-border-app/40 bg-surface shadow-md">
                <item.icon className="h-4 w-4 text-brand-light" />
              </span>
            </button>
          ))}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close add menu' : 'Add new'}
          aria-expanded={open}
          className={cn(
            'flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-brand shadow-lg shadow-black/25 transition-all hover:bg-brand-hover active:scale-95',
            open && 'rotate-45',
          )}
        >
          <Plus className="h-6 w-6 text-white" />
        </button>
      </div>
    </>
  );
}
