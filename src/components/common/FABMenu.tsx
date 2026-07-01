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
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui-classes';
import { backdropVariants, fabItemVariants, springSnappy } from '@/lib/motion';
import { haptics } from '@/lib/haptics';

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
    haptics.tap();
    setOpen(false);
    navigate(item.to, item.state ? { state: item.state } : undefined);
  };

  const handleToggle = () => {
    haptics.tap();
    setOpen((v) => !v);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close add menu"
            className="no-print fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropVariants}
          />
        )}
      </AnimatePresence>

      <div className={cn(ui.fabAnchor, 'flex flex-col items-end gap-2')}>
        <AnimatePresence>
          {open &&
            items.map((item, index) => (
              <motion.button
                key={`${item.to}-${item.label}`}
                type="button"
                onClick={() => handleSelect(item)}
                className="flex min-h-[48px] items-center gap-2"
                initial="hidden"
                animate="visible"
                exit="exit"
                variants={fabItemVariants}
                transition={{ ...springSnappy, delay: index * 0.035 }}
                whileTap={{ scale: 0.92 }}
              >
                <span className="rounded-xl border border-border-app/40 bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md">
                  {item.label}
                </span>
                <span className="flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-xl border border-border-app/40 bg-surface shadow-md">
                  <item.icon className="h-4 w-4 text-brand-light" />
                </span>
              </motion.button>
            ))}
        </AnimatePresence>

        <motion.button
          type="button"
          onClick={handleToggle}
          aria-label={open ? 'Close add menu' : 'Add new'}
          aria-expanded={open}
          whileTap={{ scale: 0.9 }}
          animate={{ rotate: open ? 45 : 0 }}
          transition={springSnappy}
          className={ui.fabButton}
        >
          <Plus className="h-6 w-6 text-white" />
        </motion.button>
      </div>
    </>
  );
}
