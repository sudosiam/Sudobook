import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  dismissOverlayHistory,
  isTopOverlay,
  registerOverlayHistory,
} from '@/lib/overlayHistory';
import { useSwipeBack } from '@/hooks/useSwipeBack';

type SwipeMode = 'edge-right' | 'panel-left' | 'none';

/**
 * Mobile overlay dismiss — Android / browser back + optional swipe.
 * Use for modals, sidebar, FAB menu, etc.
 */
export function useOverlayBack(
  open: boolean,
  enabled: boolean,
  onClose: () => void,
  options?: {
    panelRef?: RefObject<HTMLElement | null>;
    swipe?: SwipeMode;
    history?: boolean;
  },
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const closedViaPopRef = useRef(false);
  const historyHandlerRef = useRef<(() => void) | null>(null);

  const swipeMode = options?.swipe ?? (options?.panelRef ? 'edge-right' : 'none');
  const useHistory = options?.history ?? true;
  const panelRef = options?.panelRef ?? { current: null };

  useEffect(() => {
    if (!open || !enabled || !useHistory) return;

    closedViaPopRef.current = false;
    const handler = () => {
      closedViaPopRef.current = true;
      onCloseRef.current();
    };
    historyHandlerRef.current = handler;
    const unregister = registerOverlayHistory(handler);

    return () => {
      unregister();
      if (!closedViaPopRef.current && handler && isTopOverlay(handler)) {
        dismissOverlayHistory(handler);
      }
      historyHandlerRef.current = null;
    };
  }, [open, enabled, useHistory]);

  const close = useCallback(() => {
    const handler = historyHandlerRef.current;
    if (enabled && useHistory && open && handler && !closedViaPopRef.current) {
      if (dismissOverlayHistory(handler)) return;
    }
    onCloseRef.current();
  }, [enabled, useHistory, open]);

  const touchHandlers = useSwipeBack(
    open && enabled && swipeMode !== 'none',
    close,
    panelRef,
    swipeMode === 'panel-left' ? 'panel-left' : 'edge-right',
  );

  return { close, touchHandlers };
}
