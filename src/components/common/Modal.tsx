import { X } from 'lucide-react';
import { useCallback, useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap(open, panelRef, handleClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] border border-border-app/40 bg-surface p-4 pb-safe shadow-2xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button type="button" onClick={handleClose} aria-label="Close" className="icon-btn -mr-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        {description && (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
