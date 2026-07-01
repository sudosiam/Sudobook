import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from '@/components/common/Toaster';
import { useOnline } from '@/hooks/useOnline';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppStore } from '@/store/useAppStore';
import { getCurrentFY } from '@/lib/sequences';

export function AppShell() {
  useOnline();
  useAuth();
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const isMobile = useIsMobile();

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
    <div className="flex min-h-full min-w-0 overflow-x-hidden bg-app">
      <Sidebar />
      <main
        id="app-main"
        className="flex min-w-0 flex-1 flex-col"
        aria-hidden={isMobile && sidebarOpen ? true : undefined}
      >
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
