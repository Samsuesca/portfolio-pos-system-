'use client';

import { useState, useMemo } from 'react';
import { Package, Eye, Clock } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { type ProductGroup, compareSizes } from '@/lib/types';
import ProductImageOptimized from './ProductImageOptimized';

interface ProductGroupCardProps {
  group: ProductGroup;
  onAddToCart: (productId: string, isOrder: boolean) => void;
  onOpenDetail: (selectedSize?: string) => void;
  onYomberClick?: () => void;
  priority?: boolean; // Para imágenes above-the-fold
}

/**
 * Tarjeta de producto agrupado con selector de tallas
 * Muestra un solo producto por tipo de prenda con todas sus tallas disponibles
 */
export default function ProductGroupCard({
  group,
  onAddToCart,
  onOpenDetail,
  onYomberClick,
  priority = false
}: ProductGroupCardProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  // Ordenar variantes por talla
  const sortedVariants = useMemo(() =>
    [...group.variants].sort((a, b) => compareSizes(a.size, b.size)),
    [group.variants]
  );

  const selectedVariant = sortedVariants.find(v => v.size === selectedSize);
  const hasAnyStock = sortedVariants.some(v => v.stock > 0);

  // Manejar clic en botón de agregar
  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (group.isYomber && onYomberClick) {
      onYomberClick();
      return;
    }

    if (!selectedVariant) {
      // Si no hay talla seleccionada, seleccionar la primera con stock o la primera disponible
      const firstAvailable = sortedVariants.find(v => v.stock > 0) || sortedVariants[0];
      setSelectedSize(firstAvailable.size);
      return;
    }

    onAddToCart(selectedVariant.id, selectedVariant.isOrder);
  };

  // Determinar el texto del botón
  const getButtonText = (): string => {
    if (group.isYomber) return 'Consultar';
    if (!selectedSize) return 'Seleccionar talla';
    if (selectedVariant && selectedVariant.stock > 0) return 'Agregar';
    return 'Encargar';
  };

  // Determinar las clases del botón
  const getButtonClasses = (): string => {
    const base = 'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors';

    if (group.isYomber) {
      return `${base} bg-purple-600 text-white hover:bg-purple-700`;
    }
    if (!selectedSize) {
      return `${base} bg-gray-100 text-gray-600 hover:bg-gray-200`;
    }
    if (selectedVariant && selectedVariant.stock > 0) {
      return `${base} bg-brand-600 text-white hover:bg-brand-700`;
    }
    return `${base} bg-orange-500 text-white hover:bg-orange-600`;
  };

  return (
    <div
      className={`bg-white rounded-xl border overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${
        group.isYomber ? 'border-purple-200' : 'border-surface-200'
      }`}
    >
      {/* Badge Yomber */}
      {group.isYomber && (
        <div className="bg-purple-600 text-white text-xs font-semibold px-3 py-1 text-center">
          Confeccion Personalizada
        </div>
      )}

      {/* Imagen con overlay de detalles */}
      <div
        className="relative group/image cursor-pointer"
        onClick={() => onOpenDetail(selectedSize || undefined)}
      >
        <ProductImageOptimized
          images={group.images}
          primaryImageUrl={group.primaryImageUrl}
          productName={group.name}
          priority={priority}
        />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
          <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-full text-sm font-medium text-gray-700">
            <Eye className="w-4 h-4" />
            Ver detalles
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Nombre del producto */}
        <h3 className="font-semibold text-primary font-display mb-2 line-clamp-2">
          {group.name}
        </h3>

        {/* Selector de Tallas */}
        {!group.isYomber && sortedVariants.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {sortedVariants.map(variant => (
              <button
                key={variant.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSize(variant.size);
                }}
                className={`px-2.5 py-1 text-xs rounded-md border transition-all ${
                  selectedSize === variant.size
                    ? 'bg-brand-600 text-white border-brand-600'
                    : variant.stock > 0
                      ? 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                      : 'bg-orange-50 text-orange-600 border-orange-200 hover:border-orange-400'
                }`}
              >
                {variant.size}
                {variant.stock === 0 && selectedSize !== variant.size && (
                  <Package className="inline-block w-3 h-3 ml-1" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* Info de stock cuando hay talla seleccionada */}
        {selectedVariant && !group.isYomber && (
          <div className={`text-xs mb-2 ${selectedVariant.stock > 0 ? 'text-green-600' : 'text-orange-600'}`}>
            {selectedVariant.stock > 0 ? (
              <span>Disponible ({selectedVariant.stock} unid.)</span>
            ) : (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Sin stock - Se confecciona en 5-7 dias
              </span>
            )}
          </div>
        )}

        {/* Mensaje Yomber */}
        {group.isYomber && (
          <p className="text-xs text-purple-600 mb-2">
            Requiere medidas personalizadas
          </p>
        )}

        {/* Precio y botón */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xl font-bold text-brand-600 font-display">
              ${formatNumber(selectedVariant?.price ?? group.basePrice)}
            </span>
            {/* Mostrar rango si los precios varían y no hay talla seleccionada */}
            {!selectedVariant && group.basePrice !== group.maxPrice && (
              <span className="text-xs text-gray-400">
                - ${formatNumber(group.maxPrice)}
              </span>
            )}
          </div>

          {/* Botón de agregar */}
          <button
            onClick={handleAddClick}
            className={getButtonClasses()}
          >
            {getButtonText()}
          </button>
        </div>
      </div>
    </div>
  );
}
