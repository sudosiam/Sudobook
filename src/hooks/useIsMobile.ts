import { useSyncExternalStore } from 'react';

const QUERY = '(max-width: 767px)';

function subscribe(onStoreChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

/** True below Tailwind `md` (768px) — matches mobile drawer breakpoint. */
export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
