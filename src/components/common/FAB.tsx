import { Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { springSnappy } from '@/lib/motion';
import { haptics } from '@/lib/haptics';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui-classes';

interface FABProps {
  /** Navigate to this route on tap. */
  to?: string;
  /** Or run a custom handler (e.g. open a modal). */
  onClick?: () => void;
  label?: string;
}

export function FAB({ to, onClick, label = 'Add' }: FABProps) {
  const navigate = useNavigate();
  const handleClick = () => {
    haptics.tap();
    if (onClick) onClick();
    else if (to) navigate(to);
  };
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={label}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={springSnappy}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.04 }}
      className={cn(ui.fabAnchor, ui.fabButton)}
    >
      <Plus className="h-6 w-6 text-white" />
    </motion.button>
  );
}
