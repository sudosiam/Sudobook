import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const MIN_SPIN_MS = 300;

export function LoadingSpinner({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), MIN_SPIN_MS);
    return () => clearTimeout(id);
  }, []);

  if (!visible) {
    return <div className={cn('py-12', className)} aria-hidden />;
  }

  return (
    <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
      <Loader2 className={cn('h-6 w-6 animate-spin text-brand', className)} aria-hidden />
      <span className="sr-only">Loading</span>
    </div>
  );
}
