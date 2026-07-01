import { Skeleton, SkeletonChartCard, SkeletonStatGrid } from '@/components/common/Skeleton';

/** Route-level Suspense fallback that mimics page layout (BUG-6, IMP-33). */
export function PageRouteSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-3 pt-3 pb-[var(--fab-clearance)] md:max-w-3xl lg:max-w-4xl">
      <Skeleton className="h-14 rounded-xl" />
      <SkeletonStatGrid count={4} />
      <SkeletonChartCard height={180} />
    </div>
  );
}
