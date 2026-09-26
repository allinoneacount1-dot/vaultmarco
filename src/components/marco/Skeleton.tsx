/**
 * Quiet placeholders: one slow CSS pulse (no second JS animation loop), the
 * desk's machined radius, shaped like the content that will replace them.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-sm bg-(--panel-2) ${className}`} />;
}

export function SkeletonRow() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  );
}

/** Placeholder tape rows for a feed that is waiting for its first provider round. */
export function TapeSkeleton({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="mv-tape">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5" />
            <Skeleton className="h-2.5 w-3/5" />
          </div>
          <div className="w-16 space-y-2">
            <Skeleton className="ml-auto h-3 w-full" />
            <Skeleton className="ml-auto h-2.5 w-2/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
