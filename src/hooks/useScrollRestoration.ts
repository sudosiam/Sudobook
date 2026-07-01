import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Reset scroll position when navigating between routes (BUG-1). */
export function useScrollRestoration(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? ('instant' as ScrollBehavior) : 'auto' });
    document.getElementById('app-main')?.scrollTo(0, 0);
  }, [pathname]);
}
