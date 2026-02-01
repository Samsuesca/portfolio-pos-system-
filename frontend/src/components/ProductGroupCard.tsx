/**
 * ProductGroupCard - Displays a garment type with size/color selection
 *
 * Similar to the web portal's ProductGroupCard but adapted for desktop app
 * Shows one card per garment type with selectable sizes and colors
 */

import { useState, useMemo, useEffect } from 'react';
import { Plus, Package, Check, CheckCircle } from 'lucide-react';
import type { ProductGroup, ProductVariant } from '../utils/productGrouping';
import { getEmojiForCategory, getColorsForSize } from '../utils/productGrouping';

interface ProductGroupCardProps {
  group: ProductGroup;
  onSelect: (variant: ProductVariant, quantity: number) => void;
  excludeProductIds?: string[];
  filterByStock?: 'with_stock' | 'without_stock' | 'all';
  addedQuantity?: number; // Total quantity added in this session (for visual feedback)
  enforceStockLimit?: boolean; // Block quantity from exceeding available stock
}

export default function ProductGroupCard({
  group,
  onSelect,
  excludeProductIds = [],
  filterByStock = 'all',
  addedQuantity = 0,
  enforceStockLimit = false,
}: ProductGroupCardProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [showAddedFeedback, setShowAddedFeedback] = useState(false);

  // Track when addedQuantity increases to show feedback
  const [prevAddedQuantity, setPrevAddedQuantity] = useState(addedQuantity);

  useEffect(() => {
    if (addedQuantity > prevAddedQuantity) {
      setShowAddedFeedback(true);
      const timer = setTimeout(() => setShowAddedFeedback(false), 1500);
      return () => clearTimeout(timer);
    }
    setPrevAddedQuantity(addedQuantity);
  }, [addedQuantity, prevAddedQuantity]);

  // Filter out excluded products
  const availableVariants = useMemo(() => {
    let variants = group.variants.filter(v => !excludeProductIds.includes(v.productId));

    if (filterByStock === 'with_stock') {
      variants = variants.filter(v => v.stock > 0);
    } else if (filterByStock === 'without_stock') {
      variants = variants.filter(v => v.stock === 0);
    }

    return variants;
  }, [group.variants, excludeProductIds, filterByStock]);

  // Get available sizes from filtered variants
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    availableVariants.forEach(v => sizes.add(v.size));
    return Array.from(sizes).sort((a, b) => {
      const aNum = parseFloat(a);
      const bNum = parseFloat(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.localeCompare(b);
    });
  }, [availableVariants]);

  // Get colors for selected size
  const colorsForSize = useMemo(() => {
    if (!selectedSize) return [];
    return getColorsForSize(
      { ...group, variants: availableVariants },
      selectedSize
    );
  }, [availableVariants, selectedSize, group]);

  // Get the selected variant
  const selectedVariant = useMemo(() => {
    if (!selectedSize) return null;

    // If there are colors and none selected, return null
    if (colorsForSize.length > 0 && !selectedColor) return null;

    // Find the variant
    return availableVariants.find(v => {
      if (v.size !== selectedSize) return false;
      if (colorsForSize.length > 0 && v.color !== selectedColor) return false;
      return true;
    }) || null;
  }, [selectedSize, selectedColor, colorsForSize, availableVariants]);

  // Auto-select color if only one available
  useMemo(() => {
    if (selectedSize && colorsForSize.length === 1 && !selectedColor) {
      setSelectedColor(colorsForSize[0]);
    } else if (selectedSize && colorsForSize.length === 0) {
      // No colors, that's fine
      setSelectedColor(null);
    }
  }, [selectedSize, colorsForSize, selectedColor]);

  // Reset color when size changes
  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    setSelectedColor(null);
    setQuantity(1);
  };

  const handleAddClick = () => {
    if (selectedVariant) {
      onSelect(selectedVariant, quantity);
      // Reset selection
      setSelectedSize(null);
      setSelectedColor(null);
      setQuantity(1);
    }
  };

  // Get variant stock info for a size
  const getSizeStockInfo = (size: string): { hasStock: boolean; totalStock: number } => {
    const sizeVariants = availableVariants.filter(v => v.size === size);
    const totalStock = sizeVariants.reduce((sum, v) => sum + v.stock, 0);
    return { hasStock: totalStock > 0, totalStock };
  };

  // Image or emoji fallback
  const imageUrl = group.garmentTypeImageUrl;
  const emoji = getEmojiForCategory(group.garmentTypeName);

  // Price display
  const priceDisplay = group.basePrice === group.maxPrice
    ? `$${group.basePrice.toLocaleString()}`
    : `$${group.basePrice.toLocaleString()} - $${group.maxPrice.toLocaleString()}`;

  // If no variants available after filtering, don't show card
  if (availableVariants.length === 0) {
    return null;
  }

  return (
    <div className={`relative bg-white border rounded-xl p-4 transition-all ${
      addedQuantity > 0
        ? 'border-green-300 ring-1 ring-green-200'
        : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
    }`}>
      {/* Added quantity badge */}
      {addedQuantity > 0 && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 z-10">
          <CheckCircle className="w-3 h-3" />
          +{addedQuantity}
        </div>
      )}

      {/* Added feedback overlay */}
      {showAddedFeedback && (
        <div className="absolute inset-0 bg-green-100/80 rounded-xl flex items-center justify-center z-20 animate-pulse">
          <div className="flex items-center gap-2 text-green-700 font-medium">
            <CheckCircle className="w-6 h-6" />
            <span>Agregado</span>
          </div>
        </div>
      )}

      {/* Header: Image + Name + Price */}
      <div className="flex gap-4 mb-4">
        {/* Image */}
        <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={group.garmentTypeName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="text-4xl">{emoji}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate" title={group.garmentTypeName}>
            {group.garmentTypeName}
          </h3>
          <p className="text-lg font-bold text-green-600 mt-1">
            {selectedVariant ? `$${selectedVariant.price.toLocaleString()}` : priceDisplay}
          </p>
          <div className="flex items-center gap-1 mt-1 text-sm">
            {group.totalStock > 0 ? (
              <>
                <Check className="w-4 h-4 text-green-500" />
                <span className="text-green-600">{group.totalStock} disponibles</span>
              </>
            ) : (
              <>
                <Package className="w-4 h-4 text-orange-500" />
                <span className="text-orange-600">Por encargo</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Size Selector */}
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-600 mb-1.5 block">Talla</label>
        <div className="flex flex-wrap gap-1.5">
          {availableSizes.map(size => {
            const { hasStock, totalStock } = getSizeStockInfo(size);
            const isSelected = selectedSize === size;
            const isExcluded = availableVariants.filter(v => v.size === size).every(v =>
              excludeProductIds.includes(v.productId)
            );

            return (
              <button
                key={size}
                onClick={() => handleSizeSelect(size)}
                disabled={isExcluded}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200'
                    : hasStock
                      ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                      : 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400'
                } ${isExcluded ? 'opacity-40 cursor-not-allowed' : ''}`}
                title={hasStock ? `Stock: ${totalStock}` : 'Sin stock - Por encargo'}
              >
                {size}
                {!hasStock && !isSelected && (
                  <Package className="w-3 h-3 inline-block ml-1 -mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Selector (only if size selected and multiple colors) */}
      {selectedSize && colorsForSize.length > 1 && (
        <div className="mb-3">
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {colorsForSize.map(color => {
              const variant = availableVariants.find(v => v.size === selectedSize && v.color === color);
              const hasStock = variant ? variant.stock > 0 : false;
              const isSelected = selectedColor === color;

              return (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200'
                      : hasStock
                        ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                        : 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400'
                  }`}
                >
                  {color}
                  {!hasStock && !isSelected && (
                    <Package className="w-3 h-3 inline-block ml-1 -mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Single color display */}
      {selectedSize && colorsForSize.length === 1 && (
        <div className="mb-3">
          <span className="text-xs text-gray-500">Color: </span>
          <span className="text-sm font-medium text-gray-700">{colorsForSize[0]}</span>
        </div>
      )}

      {/* Selected Variant Info */}
      {selectedVariant && (
        <div className="bg-gray-50 rounded-lg p-2 mb-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">
              {group.garmentTypeName} - {selectedVariant.size}
              {selectedVariant.color && ` - ${selectedVariant.color}`}
            </span>
            <span className={selectedVariant.stock > 0 ? 'text-green-600' : 'text-orange-600'}>
              {selectedVariant.stock > 0 ? `${selectedVariant.stock} disp.` : 'Encargo'}
            </span>
          </div>
        </div>
      )}

      {/* Quantity + Add Button */}
      <div className="flex items-center gap-2">
        {selectedVariant && (
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-l-lg transition"
            >
              -
            </button>
            <input
              type="number"
              min="1"
              max={enforceStockLimit && selectedVariant.stock > 0 ? selectedVariant.stock : undefined}
              value={quantity}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                const maxVal = enforceStockLimit && selectedVariant.stock > 0
                  ? Math.min(val, selectedVariant.stock)
                  : val;
                setQuantity(maxVal);
              }}
              className="w-12 text-center border-x border-gray-300 py-1.5 focus:outline-none"
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              disabled={enforceStockLimit && selectedVariant.stock > 0 && quantity >= selectedVariant.stock}
              className={`px-3 py-1.5 rounded-r-lg transition ${
                enforceStockLimit && selectedVariant.stock > 0 && quantity >= selectedVariant.stock
                  ? 'text-gray-300 cursor-not-allowed bg-gray-50'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              +
            </button>
          </div>
        )}

        <button
          onClick={handleAddClick}
          disabled={!selectedVariant}
          className={`flex-1 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition ${
            selectedVariant
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Plus className="w-4 h-4" />
          {selectedVariant ? 'Agregar' : 'Selecciona talla'}
        </button>
      </div>
    </div>
  );
}
