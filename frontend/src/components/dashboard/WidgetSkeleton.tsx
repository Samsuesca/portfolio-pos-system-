/**
 * WidgetSkeleton - Loading skeleton for dashboard widgets
 */

interface WidgetSkeletonProps {
  rows?: number;
  showHeader?: boolean;
}

export function WidgetSkeleton({ rows = 3, showHeader = true }: WidgetSkeletonProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-6 animate-pulse">
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-slate-200 rounded" />
            <div className="h-5 w-32 bg-slate-200 rounded" />
          </div>
          <div className="h-4 w-20 bg-slate-200 rounded" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2">
            <div className="flex-1">
              <div className="h-4 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-1/2 bg-slate-100 rounded" />
            </div>
            <div className="h-6 w-16 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-4 md:p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-200 rounded-xl" />
        <div className="w-12 h-6 bg-slate-200 rounded-full" />
      </div>
      <div className="h-8 w-20 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-24 bg-slate-100 rounded" />
    </div>
  );
}

export function AlertsSkeleton() {
  return (
    <div className="mb-6 space-y-3 animate-pulse">
      <div className="bg-slate-100 rounded-xl p-4 h-24" />
    </div>
  );
}

export default WidgetSkeleton;
