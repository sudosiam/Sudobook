import { X } from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react';
import { useCallback, useId, useRef, type ReactNode } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { backdropVariants, sheetVariants } from '@/lib/motion';

const DRAG_CLOSE_OFFSET = 120;
const DRAG_CLOSE_VELOCITY = 500;

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
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useFocusTrap(open, panelRef, handleClose);

  const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > DRAG_CLOSE_OFFSET || info.velocity.y > DRAG_CLOSE_VELOCITY) {
      handleClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center">
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
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[1.25rem] border border-border-app/40 bg-surface p-4 pb-safe shadow-[var(--shadow-elev-2)] sm:rounded-2xl"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={sheetVariants}
            drag={reduceMotion ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={handleDragEnd}
          >
            <div
              aria-hidden
              onPointerDown={(e) => dragControls.start(e)}
              className="mx-auto -mt-1 mb-2 h-1.5 w-10 shrink-0 touch-none rounded-full bg-border-app sm:hidden"
            />
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
