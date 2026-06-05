interface SkeletonProps {
  className?: string;
}

export function SkeletonLine({ className = 'h-4 w-full' }: SkeletonProps): React.ReactElement {
  return <div className={`animate-shimmer rounded ${className}`} />;
}

export function SkeletonCard({ className = 'h-32' }: SkeletonProps): React.ReactElement {
  return <div className={`animate-shimmer rounded-xl ${className}`} />;
}

export function SkeletonTable({ rows = 5 }: { rows?: number }): React.ReactElement {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <SkeletonLine className="h-4 w-1/4" />
          <SkeletonLine className="h-4 w-1/3" />
          <SkeletonLine className="h-4 w-1/6" />
          <SkeletonLine className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}
