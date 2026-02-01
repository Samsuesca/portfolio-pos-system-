/**
 * CatalogTab - Product selection for catalog items in orders
 */
import { Package } from 'lucide-react';
import type { CatalogTabProps } from './types';

export default function CatalogTab({ onOpenSelector }: CatalogTabProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-3">
        Selecciona un producto del catalogo. Ideal para productos agotados o pedidos web.
      </p>

      {/* Product Selector Button */}
      <div>
        <label className="block text-xs text-gray-600 mb-2">
          Producto del Catalogo *
        </label>
        <button
          type="button"
          onClick={onOpenSelector}
          className="w-full px-6 py-4 border-2 border-dashed border-blue-400 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition flex flex-col items-center gap-2 group"
        >
          <Package className="w-8 h-8 text-blue-500 group-hover:text-blue-600" />
          <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">
            Buscar producto del catalogo
          </span>
          <span className="text-xs text-gray-500">
            Click para abrir el selector
          </span>
        </button>
      </div>

      <p className="text-xs text-gray-500 text-center">
        Los productos se agregan directamente desde el selector
      </p>
    </div>
  );
}
