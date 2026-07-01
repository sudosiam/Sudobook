import { create } from 'zustand';
import { generateUuid } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
}

const MAX_TOASTS = 5;
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = generateUuid();
    set((s) => {
      let toasts = [...s.toasts, { id, kind, message }];
      if (toasts.length > MAX_TOASTS) {
        const dropped = toasts.slice(0, toasts.length - MAX_TOASTS);
        for (const t of dropped) {
          const timer = dismissTimers.get(t.id);
          if (timer) clearTimeout(timer);
          dismissTimers.delete(t.id);
        }
        toasts = toasts.slice(-MAX_TOASTS);
      }
      return { toasts };
    });
    const durationMs = kind === 'error' ? 7000 : 4000;
    const timer = setTimeout(() => {
      dismissTimers.delete(id);
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
    dismissTimers.set(id, timer);
  },
  dismiss: (id) => {
    const timer = dismissTimers.get(id);
    if (timer) clearTimeout(timer);
    dismissTimers.delete(id);
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (message: string) => {
    haptics.success();
    useToastStore.getState().push('success', message);
  },
  error: (message: string) => {
    haptics.warning();
    useToastStore.getState().push('error', message);
  },
  info: (message: string) => useToastStore.getState().push('info', message),
};
