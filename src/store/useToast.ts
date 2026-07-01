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

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = generateUuid();
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    const durationMs = kind === 'error' ? 7000 : 4000;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, durationMs);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
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
