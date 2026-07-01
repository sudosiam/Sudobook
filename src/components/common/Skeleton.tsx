import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

/** Base shimmer block — size via className (e.g. `h-4 w-24`), or `style` for dynamic sizes. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div className={cn('skeleton', className)} style={style} aria-hidden />;
}

/** Placeholder shaped like `StatCard` — label + amount line. */
export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn('card space-y-2', className)}>
      <Skeleton className="h-2.5 w-16" />
      <Skeleton className="h-5 w-24" />
    </div>
  );
}

/** Grid of `SkeletonStatCard`s matching the Dashboard 2-column stat grid. */
export function SkeletonStatGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

/** Placeholder for a `.card` containing a heading + chart area. */
export function SkeletonChartCard({ height = 220 }: { height?: number }) {
  return (
    <div className="card">
      <Skeleton className="mb-3 h-3.5 w-32" />
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}

/** Placeholder for a `.list-row` — avatar/label on the left, amount on the right. */
export function SkeletonListRow() {
  return (
    <div className="list-row">
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-2.5 w-1/4" />
      </div>
      <div className="shrink-0 space-y-1.5 text-right">
        <Skeleton className="ml-auto h-3.5 w-16" />
        <Skeleton className="ml-auto h-2.5 w-12" />
      </div>
    </div>
  );
}

/** Placeholder `.list-shell` with N shimmering rows — use for sales/customers/vendors lists, etc. */
export function SkeletonList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="list-shell" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListRow key={i} />
      ))}
    </div>
  );
}
