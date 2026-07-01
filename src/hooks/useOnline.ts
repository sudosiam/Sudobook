import { useEffect } from 'react';
import { useSyncStore } from '@/store/useSyncStore';

/** Keep the sync store's online flag in sync with the browser. */
export function useOnline(): boolean {
  const isOnline = useSyncStore((s) => s.isOnline);
  const setOnline = useSyncStore((s) => s.setOnline);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [setOnline]);

  return isOnline;
}
