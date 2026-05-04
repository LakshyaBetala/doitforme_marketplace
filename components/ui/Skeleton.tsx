import { HTMLAttributes } from "react";

/**
 * Base shimmer block. Compose into content-shaped skeletons — never use
 * a centered spinner as a "loading" state on a populated page.
 */
type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export default function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-white/[0.04] rounded-md ${className}`}
      {...props}
    />
  );
}

/** Matches GigCard variant="detailed" shape — for /dashboard grid loading. */
export function GigCardSkeleton() {
  return (
    <div className="bg-[#13131A] rounded-2xl p-5 md:p-6 border border-white/[0.08] flex flex-col h-full">
      <Skeleton className="h-5 w-20 rounded-full mb-3" />
      <Skeleton className="h-5 w-full mb-2" />
      <Skeleton className="h-5 w-3/4 mb-3" />
      <Skeleton className="h-7 w-24 mb-auto" />
      <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

/** Matches GigCard variant="compact" shape — for /feed masonry loading. */
export function GigCardCompactSkeleton() {
  return (
    <div className="bg-[#13131A] rounded-2xl overflow-hidden border border-white/[0.08]">
      <Skeleton className="w-full aspect-square rounded-none" />
      <div className="p-3">
        <Skeleton className="h-4 w-full mb-1.5" />
        <Skeleton className="h-4 w-2/3 mb-3" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
    </div>
  );
}
