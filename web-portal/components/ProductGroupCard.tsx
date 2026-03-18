'use client';

import { useMemo } from 'react';
import { Eye, Ruler } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { type ProductGroup, compareSizes } from '@/lib/types';
import ProductImageOptimized from './ProductImageOptimized';

interface ProductGroupCardProps {
  group: ProductGroup;
  onAddToCart: (productId: string, isOrder: boolean) => void;
  onOpenDetail: (selectedSize?: string) => void;
  onYomberClick?: () => void;
  priority?: boolean;
}

/**
 * Clean product card: image + name + price range + CTA
 * Size selection happens inside the ProductDetailModal
 */
export default function ProductGroupCard({
  group,
  onOpenDetail,
  onYomberClick,
  priority = false
}: ProductGroupCardProps) {
  const sortedVariants = useMemo(() =>
    [...group.variants].sort((a, b) => compareSizes(a.size, b.size)),
    [group.variants]
  );

  const hasAnyStock = sortedVariants.some(v => v.stock > 0);
  const totalSizes = sortedVariants.length;
  const inStockCount = sortedVariants.filter(v => v.stock > 0).length;

  const handleClick = () => {
    if (group.isYomber && onYomberClick) {
      onYomberClick();
      return;
    }
    onOpenDetail();
  };

  return (
    <div
      onClick={handleClick}
      className={`group bg-white rounded-xl border overflow-hidden cursor-pointer
        transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
        ${group.isYomber ? 'border-purple-200 ring-1 ring-purple-100' : 'border-stone-200 hover:border-brand-300'}`}
    >
      {/* Yomber badge */}
      {group.isYomber && (
        <div className="bg-purple-600 text-white text-[11px] font-semibold px-3 py-1 text-center tracking-wide uppercase">
          Confeccion Personalizada
        </div>
      )}

      {/* Image with hover overlay */}
      <div className="relative">
        <ProductImageOptimized
          images={group.images}
          primaryImageUrl={group.primaryImageUrl}
          productName={group.name}
          priority={priority}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/95 rounded-full text-sm font-medium text-stone-700 shadow-sm">
            <Eye className="w-4 h-4" />
            Ver tallas y detalles
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Product name */}
        <h3 className="font-semibold text-stone-900 font-display text-[15px] leading-tight mb-1 line-clamp-2">
          {group.name}
        </h3>

        {/* Size availability summary */}
        {!group.isYomber && totalSizes > 0 && (
          <p className="text-xs text-stone-400 mb-3">
            {inStockCount === totalSizes
              ? `${totalSizes} ${totalSizes === 1 ? 'talla disponible' : 'tallas disponibles'}`
              : inStockCount > 0
                ? `${inStockCount} de ${totalSizes} ${totalSizes === 1 ? 'talla' : 'tallas'} en stock`
                : `${totalSizes} ${totalSizes === 1 ? 'talla' : 'tallas'} · Se confeccionan bajo pedido`
            }
          </p>
        )}

        {/* Yomber message */}
        {group.isYomber && (
          <p className="text-xs text-purple-500 mb-3 flex items-center gap-1">
            <Ruler className="w-3 h-3" />
            Requiere medidas personalizadas
          </p>
        )}

        {/* Price + CTA */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="text-lg font-bold text-stone-900 font-mono tabular-nums">
              ${formatNumber(group.basePrice)}
            </span>
            {group.basePrice !== group.maxPrice && (
              <span className="text-sm text-stone-400 font-mono tabular-nums">
                {' '}- ${formatNumber(group.maxPrice)}
              </span>
            )}
          </div>

          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
            ${group.isYomber
              ? 'bg-purple-50 text-purple-600 group-hover:bg-purple-100'
              : hasAnyStock
                ? 'bg-brand-50 text-brand-600 group-hover:bg-brand-100'
                : 'bg-orange-50 text-orange-600 group-hover:bg-orange-100'
            }`}
          >
            {group.isYomber ? 'Consultar' : hasAnyStock ? 'Ver tallas' : 'Encargar'}
          </span>
        </div>
      </div>
    </div>
  );
}
