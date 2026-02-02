'use client';

/**
 * Skeleton Loading Components for Web Portal
 *
 * Provides skeleton placeholders for product catalog and cart views.
 *
 * Usage:
 *   import { ProductGridSkeleton, CartSkeleton } from '@/components/ui/Skeleton';
 *   {loading ? <ProductGridSkeleton /> : <ProductGrid products={products} />}
 */

import { cn } from '@/lib/utils';

// ============================================
// Base Skeleton Component
// ============================================

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
  shimmer?: boolean;
}

export function Skeleton({ className, style, shimmer = true }: SkeletonProps) {
  return (
    <div
      className={cn(
        'rounded',
        shimmer ? 'animate-shimmer' : 'animate-pulse bg-gray-200',
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

// ============================================
// Product Card Skeleton
// ============================================

export function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
      {/* Image placeholder */}
      <Skeleton className="w-full aspect-square" />

      <div className="p-4 space-y-3">
        {/* Product name */}
        <Skeleton className="h-5 w-3/4" />

        {/* Size buttons */}
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-10 rounded-md" />
          ))}
        </div>

        {/* Stock info */}
        <Skeleton className="h-3 w-24" />

        {/* Price and button */}
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Product Grid Skeleton
// ============================================

interface ProductGridSkeletonProps {
  count?: number;
  columns?: 2 | 3 | 4;
}

export function ProductGridSkeleton({
  count = 8,
  columns = 4,
}: ProductGridSkeletonProps) {
  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} gap-4 md:gap-6`}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ============================================
// Catalog Header Skeleton
// ============================================

export function CatalogHeaderSkeleton() {
  return (
    <div className="bg-white border-b border-surface-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and school name */}
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>

          {/* Cart button */}
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Search and Filter Skeleton
// ============================================

export function SearchBarSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex gap-3">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
    </div>
  );
}

export function CategoryFiltersSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 pb-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-9 rounded-full flex-shrink-0"
            style={{ width: `${60 + Math.random() * 40}px` }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Full Catalog Page Skeleton
// ============================================

export function CatalogPageSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <CatalogHeaderSkeleton />
      <SearchBarSkeleton />
      <CategoryFiltersSkeleton />
      <div className="max-w-7xl mx-auto px-4 pb-20">
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}

// ============================================
// Cart Item Skeleton
// ============================================

export function CartItemSkeleton() {
  return (
    <div className="flex gap-4 p-4 bg-white rounded-xl border border-surface-200">
      <Skeleton className="w-20 h-20 rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>
    </div>
  );
}

export function CartSkeleton({ items = 3 }: { items?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <CartItemSkeleton key={i} />
      ))}
      <div className="bg-white rounded-xl border border-surface-200 p-4 space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-28" />
        </div>
        <Skeleton className="h-12 w-full rounded-xl mt-4" />
      </div>
    </div>
  );
}

// ============================================
// Product Detail Modal Skeleton
// ============================================

export function ProductDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Image gallery */}
      <Skeleton className="w-full aspect-square rounded-xl" />

      {/* Product info */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/2" />

        {/* Size selector */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 w-12 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Price and add button */}
        <div className="flex items-center justify-between pt-4">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
