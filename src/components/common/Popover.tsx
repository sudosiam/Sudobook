import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { FOCUS_TRAP_ALLOW } from '@/hooks/useFocusTrap';
import { popoverVariants } from '@/lib/motion';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  panel: ReactNode;
  className?: string;
  panelClassName?: string;
  /** `stretch` = match anchor width (min `minPanelWidth`); `end` = fixed `panelWidth` aligned right */
  align?: 'stretch' | 'end';
  panelWidth?: number;
  minPanelWidth?: number;
}

const VIEWPORT_PAD = 12;
const ESTIMATED_PANEL_HEIGHT = 300;

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/** Anchored dropdown portaled to body — avoids overflow clipping; deferred outside-click for mobile. */
export function Popover({
  open,
  onClose,
  children,
  panel,
  className,
  panelClassName,
  align = 'stretch',
  panelWidth = 256,
  minPanelWidth = 0,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const updatePosition = () => {
    const anchor = rootRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const maxWidth = window.innerWidth - VIEWPORT_PAD * 2;
    const width = clamp(
      align === 'end' ? panelWidth : Math.max(rect.width, minPanelWidth),
      120,
      maxWidth,
    );

    const left =
      align === 'end'
        ? clamp(rect.right - width, VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD)
        : clamp(rect.left, VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD);

    let top = rect.bottom + 4;
    if (top + ESTIMATED_PANEL_HEIGHT > window.innerHeight - VIEWPORT_PAD) {
      top = clamp(rect.top - ESTIMATED_PANEL_HEIGHT - 4, VIEWPORT_PAD, rect.top - 4);
    }

    setPanelStyle({ top, left, width });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPanelStyle(null);
      return;
    }
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, align, panelWidth, minPanelWidth]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  // Defer outside-click so the same tap that opens does not instantly close (mobile).
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onClose();
    };

    const timer = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [open, onClose]);

  const panelNode = (
    <AnimatePresence>
      {open && panelStyle && (
        <motion.div
          style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
          className={cn(
            'fixed z-[100] origin-top overflow-hidden rounded-xl border border-border-app/60 bg-surface shadow-[var(--shadow-elev-2)]',
            panelClassName,
          )}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={popoverVariants}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Ref on inner node — AnimatePresence reads child.props.ref and triggers React 18.3 warning on motion.div */}
          <div ref={panelRef} className="h-full w-full" {...{ [FOCUS_TRAP_ALLOW]: '' }}>
            {panel}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {children}
      {createPortal(panelNode, document.body)}
    </div>
  );
}
