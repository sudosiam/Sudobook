import { ArrowLeft, Menu } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

/** Primary destinations reachable from the sidebar — these show the menu button. */
const PRIMARY_ROUTES = new Set([
  '/',
  '/sales',
  '/purchases',
  '/expenses',
  '/inventory',
  '/customers',
  '/vendors',
  '/banking',
  '/ledger',
  '/reports',
  '/growth',
  '/payments',
  '/more',
  '/settings',
]);

export function TopBar({
  title,
  right,
  back,
}: {
  title: string;
  right?: ReactNode;
  /** Force showing/hiding the back button; auto-detected from the route otherwise. */
  back?: boolean;
}) {
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const navigate = useNavigate();
  const location = useLocation();

  const showBack = back ?? !PRIMARY_ROUTES.has(location.pathname);

  return (
    <div className="sticky top-0 z-30 bg-app/95 pt-safe backdrop-blur-md">
      <header className="flex h-14 items-center justify-between border-b border-border-app/40 px-1.5 sm:px-3">
        <div className="flex min-w-0 items-center gap-0.5">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="icon-btn shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-[22px] w-[22px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="icon-btn shrink-0 md:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-[26px] w-[26px]" />
            </button>
          )}
          <h1 className="truncate pl-1 text-base font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 overflow-visible pr-2 sm:pr-2.5">
          {right}
        </div>
      </header>
    </div>
  );
}
