import { useEffect, useLayoutEffect, type ReactNode, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  estimateSize?: number;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  /** When false, skips list-shell card styling (e.g. inventory cards). */
  shell?: boolean;
  /** Called when the user scrolls near the end (infinite load). */
  onLoadMore?: () => void;
  hasMore?: boolean;
  footer?: ReactNode;
}

/** Window-scrolled virtual list — only mounts visible rows. */
export function VirtualList<T>({
  items,
  estimateSize = 52,
  getKey,
  renderItem,
  className,
  shell = true,
  onLoadMore,
  hasMore = false,
  footer,
}: VirtualListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const loadLock = useRef(false);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    if (listRef.current) setScrollMargin(listRef.current.offsetTop);
  }, [items.length]);

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan: 10,
    scrollMargin,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!onLoadMore || !hasMore || loadLock.current) return;
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= items.length - 5) {
      loadLock.current = true;
      onLoadMore();
      queueMicrotask(() => {
        loadLock.current = false;
      });
    }
  }, [virtualItems, items.length, onLoadMore, hasMore]);

  return (
    <div ref={listRef} className={cn(shell && 'list-shell', className)}>
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualItems.map((vRow) => {
          const item = items[vRow.index];
          if (!item) return null;
          return (
            <div
              key={getKey(item, vRow.index)}
              data-index={vRow.index}
              ref={virtualizer.measureElement}
              className={cn(
                'absolute left-0 top-0 w-full',
                shell && 'border-b border-border-app/35 last:border-0',
              )}
              style={{ transform: `translateY(${vRow.start - scrollMargin}px)` }}
            >
              {renderItem(item, vRow.index)}
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
