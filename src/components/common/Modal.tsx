import { ArrowLeft, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useOverlayBack } from '@/hooks/useOverlayBack';
import { backdropVariants, dialogVariants, fullScreenModalVariants } from '@/lib/motion';
import { cn } from '@/lib/utils';

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
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();

  const { close: handleClose, touchHandlers } = useOverlayBack(open, isMobile, onClose, {
    panelRef,
    swipe: isMobile ? 'edge-right' : 'none',
  });

  useFocusTrap(open, panelRef, handleClose);

  const panelVariants = isMobile || reduceMotion ? fullScreenModalVariants : dialogVariants;

  return (
    <AnimatePresence>
      {open && (
        <div
          className={cn(
            'fixed inset-0 z-[90]',
            isMobile ? 'flex flex-col' : 'flex items-center justify-center p-4',
          )}
        >
          {!isMobile && (
            <motion.button
              type="button"
              aria-label="Close dialog"
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleClose}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={backdropVariants}
            />
          )}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className={cn(
              'relative z-10 flex w-full flex-col bg-surface',
              isMobile
                ? 'min-h-dvh max-h-dvh overflow-hidden touch-pan-y'
                : 'max-h-[90vh] max-w-md overflow-y-auto rounded-2xl border border-border-app/40 p-4 shadow-[var(--shadow-elev-2)]',
            )}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={panelVariants}
            {...touchHandlers}
          >
            <div
              className={cn(
                'flex shrink-0 items-center gap-1 border-border-app/40',
                isMobile
                  ? 'border-b px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]'
                  : 'mb-3 justify-between',
              )}
            >
              {isMobile ? (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="icon-btn shrink-0"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="h-[22px] w-[22px]" />
                  </button>
                  <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
                    {title}
                  </h2>
                </>
              ) : (
                <>
                  <h2 id={titleId} className="text-base font-semibold text-foreground">
                    {title}
                  </h2>
                  <button type="button" onClick={handleClose} aria-label="Close" className="icon-btn -mr-1">
                    <X className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            {description && (
              <p id={descriptionId} className="sr-only">
                {description}
              </p>
            )}
            <div
              className={cn(
                isMobile && 'flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3',
              )}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
