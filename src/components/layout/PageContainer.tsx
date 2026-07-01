import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Standard scrollable page body — compact, mobile-first. */
export function PageContainer({
  children,
  className,
  fab = true,
}: {
  children: ReactNode;
  className?: string;
  /** Reserve space for the fixed FAB (default true). */
  fab?: boolean;
}) {
  return (
    <main
      className={cn(
        'mx-auto w-full max-w-2xl px-3 pt-3 md:max-w-3xl lg:max-w-4xl',
        fab ? 'pb-[var(--fab-clearance)] md:pb-4' : 'pb-3 md:pb-4',
        className,
      )}
    >
      {children}
    </main>
  );
}
