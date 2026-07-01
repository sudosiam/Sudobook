import { type ComponentType, lazy } from 'react';

type Module<T> = { default: T };

/** Lazy import with one automatic retry (helps after PWA deploys invalidate old chunks). */
export function lazyRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<Module<T>>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (first) {
      console.warn('[lazyRetry] chunk load failed, retrying once…', first);
      await new Promise((r) => setTimeout(r, 1500));
      return factory();
    }
  });
}
