import { Printer } from 'lucide-react';

/** Compact print control for report top bars. */
export function PrintIconButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print flex h-12 w-12 min-h-[48px] min-w-[48px] items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-hover hover:text-foreground active:bg-surface-hover"
      aria-label="Print report"
    >
      <Printer className="h-4 w-4" />
    </button>
  );
}
