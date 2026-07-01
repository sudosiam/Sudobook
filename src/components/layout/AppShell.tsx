import { useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/common/Toaster';
import { useOnline } from '@/hooks/useOnline';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import { useAppStore } from '@/store/useAppStore';
import { getCurrentFY } from '@/lib/sequences';
import { isPrimaryRoute } from '@/lib/navigation';

export function AppShell() {
  useOnline();
  useAuth();
  useScrollRestoration();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);

  const pageSwipeEnabled = isMobile && !sidebarOpen && !isPrimaryRoute(location.pathname);
  const goBack = useCallback(() => navigate(-1), [navigate]);
  const pageSwipeHandlers = useSwipeBack(pageSwipeEnabled, goBack, mainRef, 'edge-right');

  useEffect(() => {
    const refreshFY = () => useAppStore.getState().setCurrentFY(getCurrentFY());
    refreshFY();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshFY();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return (
    <div className="flex min-h-dvh min-w-0 overflow-x-hidden bg-app">
      <Sidebar />
      <main
        id="app-main"
        ref={mainRef}
        className="flex min-h-dvh min-w-0 flex-1 flex-col"
        aria-hidden={isMobile && sidebarOpen ? true : undefined}
        {...pageSwipeHandlers}
      >
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
