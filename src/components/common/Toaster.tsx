import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useToastStore, type ToastKind } from '@/store/useToast';

const config: Record<ToastKind, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-success' },
  error: { icon: XCircle, className: 'text-danger' },
  info: { icon: Info, className: 'text-brand-light' },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      className="fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 pt-safe"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => {
        const { icon: Icon, className } = config[t.kind];
        return (
          <button
            key={t.id}
            type="button"
            role={t.kind === 'error' ? 'alert' : 'status'}
            onClick={() => dismiss(t.id)}
            className="flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border-app/40 bg-surface px-3 py-2.5 text-left shadow-md"
          >
            <Icon className={`h-5 w-5 shrink-0 ${className}`} aria-hidden />
            <span className="text-sm text-foreground">{t.message}</span>
          </button>
        );
      })}
    </div>
  );
}
