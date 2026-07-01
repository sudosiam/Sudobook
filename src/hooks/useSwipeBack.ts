import { useCallback, useRef, type RefObject, type TouchEvent as ReactTouchEvent } from 'react';

const EDGE_PX = 28;
const SWIPE_MIN = 72;
const SWIPE_MAX_VERTICAL = 56;

type SwipeMode = 'edge-right' | 'panel-left';

function resetTransform(el: HTMLElement | null): void {
  if (!el) return;
  el.style.transform = '';
  el.style.transition = '';
}

/**
 * Touch swipe to go back / dismiss.
 * - edge-right: iOS-style — start at left screen edge, swipe right
 * - panel-left: drag panel left (sidebar)
 */
export function useSwipeBack(
  enabled: boolean,
  onBack: () => void,
  panelRef: RefObject<HTMLElement | null>,
  mode: SwipeMode = 'edge-right',
) {
  const touchRef = useRef<{ x: number; y: number; tracking: boolean } | null>(null);

  const onTouchStart = useCallback(
    (e: ReactTouchEvent) => {
      if (!enabled) return;
      const t = e.touches[0];
      if (!t) return;

      if (mode === 'edge-right') {
        if (t.clientX > EDGE_PX) return;
      }

      touchRef.current = { x: t.clientX, y: t.clientY, tracking: true };
    },
    [enabled, mode],
  );

  const onTouchMove = useCallback(
    (e: ReactTouchEvent) => {
      const start = touchRef.current;
      if (!start?.tracking) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      if (dy > SWIPE_MAX_VERTICAL) {
        start.tracking = false;
        resetTransform(panelRef.current);
        return;
      }

      const el = panelRef.current;
      if (!el) return;

      if (mode === 'edge-right') {
        if (dx < 0) {
          start.tracking = false;
          resetTransform(el);
          return;
        }
        el.style.transition = 'none';
        el.style.transform = `translateX(${Math.min(dx, 100)}px)`;
      }
      // panel-left: no inline transform — motion/aside owns x animation
    },
    [mode, panelRef],
  );

  const onTouchEnd = useCallback(
    (e: ReactTouchEvent) => {
      const start = touchRef.current;
      touchRef.current = null;
      if (!start?.tracking) {
        resetTransform(panelRef.current);
        return;
      }

      const t = e.changedTouches[0];
      const dx = t ? t.clientX - start.x : 0;
      resetTransform(panelRef.current);

      if (mode === 'edge-right' && dx >= SWIPE_MIN) onBack();
      if (mode === 'panel-left' && dx <= -SWIPE_MIN) onBack();
    },
    [mode, onBack, panelRef],
  );

  return enabled
    ? { onTouchStart, onTouchMove, onTouchEnd }
    : { onTouchStart: undefined, onTouchMove: undefined, onTouchEnd: undefined };
}
