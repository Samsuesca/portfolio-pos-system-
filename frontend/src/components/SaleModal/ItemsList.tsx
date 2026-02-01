/**
 * Items List - Sale Items grouped by school
 * Displays items in the sale cart with multi-school support
 */
import { Trash2, Building2 } from 'lucide-react';
import type { SaleItemCreateExtended } from './types';

interface ItemsListProps {
  items: SaleItemCreateExtended[];
  itemsBySchool: Map<string, SaleItemCreateExtended[]>;
  onRemoveItem: (index: number) => void;
  getProductName: (productId: string, isGlobal: boolean) => string;
}

export default function ItemsList({
  items,
  itemsBySchool,
  onRemoveItem,
  getProductName,
}: ItemsListProps) {
  const calculateTotal = () => {
    return items.reduce((total, item) => total + (item.quantity * item.unit_price), 0);
  };

  return (
    <div className="border-t border-gray-200 pt-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Productos en la Venta
        {itemsBySchool.size > 1 && (
          <span className="ml-2 text-sm font-normal text-blue-600">
            ({itemsBySchool.size} colegios)
          </span>
        )}
      </h3>

      {/* Items grouped by school */}
      <div className="space-y-4">
        {Array.from(itemsBySchool.entries()).map(([schoolId, schoolItems]) => {
          const schoolTotal = schoolItems.reduce(
            (sum, item) => sum + (item.quantity * item.unit_price),
            0
          );
          return (
            <div key={schoolId} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* School header - only show if multiple schools */}
              {itemsBySchool.size > 1 && (
                <div className="bg-blue-50 px-4 py-2 flex items-center justify-between border-b border-blue-200">
                  <span className="font-medium text-blue-800 flex items-center">
                    <Building2 className="w-4 h-4 mr-2" />
                    {schoolItems[0].school_name}
                  </span>
                  <span className="text-sm text-blue-600 font-medium">
                    Subtotal: ${schoolTotal.toLocaleString()}
                  </span>
                </div>
              )}

              {/* Items for this school */}
              <div className="divide-y divide-gray-100">
                {schoolItems.map((item) => {
                  // Find original index for removal
                  const originalIndex = items.findIndex(
                    i => i.product_id === item.product_id &&
                         i.school_id === item.school_id &&
                         i.is_global === item.is_global
                  );
                  return (
                    <div
                      key={`${item.school_id}-${item.product_id}-${item.is_global}`}
                      className={`flex items-center justify-between p-3 ${
                        item.is_global ? 'bg-purple-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {item.display_name || getProductName(item.product_id, item.is_global)}
                          {item.is_global && (
                            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              Global
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-600">
                          {item.size && <span className="font-medium">Talla: {item.size} | </span>}
                          Cantidad: {item.quantity} × ${item.unit_price.toLocaleString()} = ${(item.quantity * item.unit_price).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(originalIndex)}
                        className="ml-4 text-red-600 hover:text-red-800 transition"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-gray-900">
            {itemsBySchool.size > 1 ? 'Total General:' : 'Total:'}
          </span>
          <span className="text-2xl font-bold text-blue-600">
            ${calculateTotal().toLocaleString()}
          </span>
        </div>
        {itemsBySchool.size > 1 && (
          <p className="text-sm text-gray-500 mt-1">
            Se crearán {itemsBySchool.size} ventas separadas (una por colegio)
          </p>
        )}
      </div>
    </div>
  );
}
