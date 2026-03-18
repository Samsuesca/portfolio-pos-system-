export default function CatalogLoading() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header skeleton */}
      <div className="bg-white border-b border-stone-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="w-20 h-8 bg-stone-200 rounded animate-pulse" />
          <div className="w-48 h-6 bg-stone-200 rounded animate-pulse" />
          <div className="w-24 h-8 bg-stone-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Product grid skeleton */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="aspect-square bg-stone-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-stone-200 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-stone-100 rounded w-1/2 animate-pulse" />
                <div className="h-5 bg-stone-200 rounded w-1/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
