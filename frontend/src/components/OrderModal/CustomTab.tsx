/**
 * CustomTab - Manual price custom item form for orders
 */
import { Plus } from 'lucide-react';
import type { CustomTabProps } from './types';

export default function CustomTab({
  garmentTypes,
  customGarmentTypeId,
  customQuantity,
  customSize,
  customColor,
  customPrice,
  customNotes,
  customEmbroideryText,
  onGarmentTypeChange,
  onQuantityChange,
  onSizeChange,
  onColorChange,
  onPriceChange,
  onNotesChange,
  onEmbroideryTextChange,
  onAddItem,
}: CustomTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-3">
        Para productos fuera del catalogo, tallas especiales, o con modificaciones. Precio manual requerido.
      </p>

      {/* Garment Type */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Tipo de Prenda *</label>
        <select
          value={customGarmentTypeId}
          onChange={(e) => onGarmentTypeChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="">Selecciona tipo</option>
          {garmentTypes.map((gt) => (
            <option key={gt.id} value={gt.id}>
              {gt.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Size */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Talla</label>
          <input
            type="text"
            value={customSize}
            onChange={(e) => onSizeChange(e.target.value)}
            placeholder="ej: XL, 2, 18"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        {/* Color */}
        <div>
          <label className="block text-xs text-gray-600 mb-1">Color</label>
          <input
            type="text"
            value={customColor}
            onChange={(e) => onColorChange(e.target.value)}
            placeholder="ej: Azul marino"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Price */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Precio Unitario *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            type="number"
            min="0"
            value={customPrice || ''}
            onChange={(e) => onPriceChange(parseInt(e.target.value) || 0)}
            placeholder="Ingresa el precio"
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Embroidery Text */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Texto Bordado</label>
        <input
          type="text"
          value={customEmbroideryText}
          onChange={(e) => onEmbroideryTextChange(e.target.value)}
          placeholder="Nombre para bordar"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Notas / Especificaciones</label>
        <textarea
          value={customNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Detalles especiales, modificaciones, etc."
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
        />
      </div>

      {/* Quantity */}
      <div>
        <label className="block text-xs text-gray-600 mb-1">Cantidad *</label>
        <input
          type="number"
          min="1"
          value={customQuantity}
          onChange={(e) => onQuantityChange(parseInt(e.target.value) || 1)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <button
        type="button"
        onClick={onAddItem}
        className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center justify-center"
      >
        <Plus className="w-4 h-4 mr-2" />
        Agregar Personalizado
      </button>
    </div>
  );
}
