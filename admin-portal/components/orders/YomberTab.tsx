'use client';

/**
 * YomberTab - Custom measurements form for yomber orders
 */
import { Plus, AlertCircle, Ruler } from 'lucide-react';
import YomberMeasurementsForm from './YomberMeasurementsForm';
import type { YomberTabProps } from './types';

export default function YomberTab({
  products,
  garmentTypes,
  yomberProducts,
  yomberProductId,
  yomberQuantity,
  yomberMeasurements,
  yomberAdditionalPrice,
  yomberEmbroideryText,
  onOpenSelector,
  onQuantityChange,
  onMeasurementsChange,
  onAdditionalPriceChange,
  onEmbroideryTextChange,
  onAddItem,
}: YomberTabProps) {
  if (yomberProducts.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
        <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
        <p className="text-sm text-yellow-700 font-medium">No hay productos Yomber configurados</p>
        <p className="text-xs text-yellow-600 mt-1">
          Configura tipos de prenda con "medidas personalizadas" para habilitar yombers
        </p>
      </div>
    );
  }

  const selectedProduct = products.find(p => p.id === yomberProductId);
  const selectedGarmentType = selectedProduct
    ? garmentTypes.find(gt => gt.id === selectedProduct.garment_type_id)
    : null;

  return (
    <div className="space-y-4">
      {/* Direct Yomber Product Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Selecciona el Yomber *
        </label>
        <button
          type="button"
          onClick={onOpenSelector}
          className="w-full px-4 py-2 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center justify-center gap-2"
        >
          <Ruler className="w-4 h-4" />
          {yomberProductId ? 'Cambiar producto' : 'Seleccionar producto yomber'}
        </button>
      </div>

      {/* Show selected yomber info */}
      {yomberProductId && selectedProduct && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="text-sm">
            <p className="font-medium text-purple-900">
              {selectedGarmentType?.name} - Talla {selectedProduct.size}
            </p>
            <p className="text-purple-700">
              Precio base: ${Number(selectedProduct.price).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Yomber Measurements - only show when product selected */}
      {yomberProductId && selectedProduct && (
        <>
          <YomberMeasurementsForm
            measurements={yomberMeasurements}
            onChange={onMeasurementsChange}
          />

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Cantidad *</label>
              <input
                type="number"
                min="1"
                value={yomberQuantity}
                onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            {/* Additional Price */}
            <div>
              <label className="block text-xs text-slate-600 mb-1">Adicional (opcional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input
                  type="number"
                  min="0"
                  value={yomberAdditionalPrice || ''}
                  onChange={(e) => onAdditionalPriceChange(parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>

          {/* Embroidery Text */}
          <div>
            <label className="block text-xs text-slate-600 mb-1">Texto Bordado</label>
            <input
              type="text"
              value={yomberEmbroideryText}
              onChange={(e) => onEmbroideryTextChange(e.target.value)}
              placeholder="Nombre para bordar"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {/* Total Price Summary */}
          {(() => {
            const basePrice = Number(selectedProduct.price);
            const totalPrice = (basePrice + yomberAdditionalPrice) * yomberQuantity;
            return (
              <div className="bg-purple-100 border border-purple-300 rounded-lg p-3 text-center">
                <p className="text-sm text-purple-700">
                  {yomberQuantity}x ${(basePrice + yomberAdditionalPrice).toLocaleString()}
                </p>
                <p className="font-bold text-lg text-purple-900">
                  Total: ${totalPrice.toLocaleString()}
                </p>
              </div>
            );
          })()}

          <button
            type="button"
            onClick={onAddItem}
            className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Yomber
          </button>
        </>
      )}
    </div>
  );
}
