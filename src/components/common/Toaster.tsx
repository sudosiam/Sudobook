import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { useToastStore, type ToastKind } from '@/store/useToast';
import { toastVariants } from '@/lib/motion';

const config: Record<ToastKind, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-success' },
  error: { icon: XCircle, className: 'text-danger' },
  info: { icon: Info, className: 'text-brand-light' },
};

const SWIPE_DISMISS_OFFSET = 60;

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 pb-safe md:bottom-auto md:top-4 md:pb-0"
      aria-live="polite"
      aria-relevant="additions"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const { icon: Icon, className } = config[t.kind];
          const handleDragEnd = (_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
            if (Math.abs(info.offset.x) > SWIPE_DISMISS_OFFSET) dismiss(t.id);
          };
          return (
            <motion.button
              key={t.id}
              type="button"
              role={t.kind === 'error' ? 'alert' : 'status'}
              onClick={() => dismiss(t.id)}
              layout
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={toastVariants}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.6}
              onDragEnd={handleDragEnd}
              whileTap={{ scale: 0.97 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border-app/40 bg-surface px-3 py-2.5 text-left shadow-[var(--shadow-elev-2)]"
            >
              <Icon className={`h-5 w-5 shrink-0 ${className}`} aria-hidden />
              <span className="text-sm text-foreground">{t.message}</span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
