import { useEffect, useRef, useState } from 'react';

/** Simple pull-to-refresh for mobile list/dashboard pages (BUG-57, IMP-77). */
export function usePullToRefresh(onRefresh: () => Promise<void>, enabled = true): {
  pulling: boolean;
  pullPx: number;
} {
  const [pullPx, setPullPx] = useState(0);
  const [pulling, setPulling] = useState(false);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 8 || busy.current) return;
      startY.current = e.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (window.scrollY > 8 || busy.current) return;
      const y = e.touches[0]?.clientY ?? 0;
      const delta = Math.max(0, y - startY.current);
      pullRef.current = Math.min(delta, 96);
      setPullPx(pullRef.current);
      setPulling(delta > 24);
    };

    const onTouchEnd = () => {
      const shouldRefresh = pullRef.current > 72;
      pullRef.current = 0;
      setPullPx(0);
      setPulling(false);
      if (!shouldRefresh || busy.current) return;
      busy.current = true;
      void onRefresh().finally(() => {
        busy.current = false;
      });
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [enabled, onRefresh]);

  return { pulling, pullPx };
}
