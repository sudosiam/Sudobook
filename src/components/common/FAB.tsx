import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    if (onClick) onClick();
    else if (to) navigate(to);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-3 z-30 flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-2xl bg-brand shadow-lg shadow-black/25 transition-all hover:bg-brand-hover active:scale-95"
    >
      <Plus className="h-6 w-6 text-white" />
    </button>
  );
}
