/**
 * ItemsList - Order items list grouped by school
 */
import { Trash2, Building2 } from 'lucide-react';
import type { OrderItemForm, ItemsListProps } from './types';
import type { OrderType } from '../../types/api';

// Helper to render order type badge
const getOrderTypeBadge = (orderType: OrderType | undefined) => {
  switch (orderType) {
    case 'catalog':
      return <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">Catalogo</span>;
    case 'yomber':
      return <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">Yomber</span>;
    case 'custom':
      return <span className="px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">Personal.</span>;
    default:
      return null;
  }
};

interface ItemRowProps {
  item: OrderItemForm;
  onRemove: () => void;
}

function ItemRow({ item, onRemove }: ItemRowProps) {
  return (
    <tr className="text-sm">
      <td className="py-2">
        <div>
          <p className="font-medium">{item.displayName}</p>
          {item.embroidery_text && (
            <p className="text-xs text-gray-500">Bordado: {item.embroidery_text}</p>
          )}
          {item.custom_measurements && (
            <p className="text-xs text-purple-600">Con medidas personalizadas</p>
          )}
          {/* Stock reservation indicator for "pisar" functionality */}
          {item.order_type === 'catalog' && item.stock_available !== undefined && item.stock_available > 0 && (
            <p className="text-xs text-green-600">
              {item.quantity <= item.stock_available
                ? `Se reserva del inventario (${item.stock_available} disponibles)`
                : `${item.stock_available} del inventario + ${item.quantity - item.stock_available} por encargo`
              }
            </p>
          )}
          {item.order_type === 'catalog' && (item.stock_available === undefined || item.stock_available === 0) && (
            <p className="text-xs text-orange-600">Por encargo (sin stock)</p>
          )}
        </div>
      </td>
      <td className="py-2 text-center">
        {getOrderTypeBadge(item.order_type)}
      </td>
      <td className="py-2 text-center">{item.quantity}</td>
      <td className="py-2 text-right">${item.unitPrice.toLocaleString()}</td>
      <td className="py-2 text-right font-medium">
        ${(item.unitPrice * item.quantity).toLocaleString()}
      </td>
      <td className="py-2 text-right">
        <button
          type="button"
          onClick={onRemove}
          className="text-red-500 hover:text-red-700 p-1"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

interface SchoolItemsGroupProps {
  schoolId: string;
  schoolItems: OrderItemForm[];
  showSchoolHeader: boolean;
  onRemoveItem: (tempId: string) => void;
}

function SchoolItemsGroup({ schoolId, schoolItems, showSchoolHeader, onRemoveItem }: SchoolItemsGroupProps) {
  const schoolTotal = schoolItems.reduce(
    (sum, item) => sum + (item.unitPrice * item.quantity),
    0
  );

  return (
    <div key={schoolId} className="border border-gray-200 rounded-lg overflow-hidden">
      {/* School header - only show if multiple schools */}
      {showSchoolHeader && (
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

      {/* Items table for this school */}
      <div className="bg-gray-50 p-4 overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="text-xs text-gray-500 uppercase">
              <th className="text-left pb-2">Item</th>
              <th className="text-center pb-2">Tipo</th>
              <th className="text-center pb-2">Cant.</th>
              <th className="text-right pb-2">Precio</th>
              <th className="text-right pb-2">Subtotal</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {schoolItems.map((item) => (
              <ItemRow
                key={item.tempId}
                item={item}
                onRemove={() => onRemoveItem(item.tempId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ItemsList({ items, itemsBySchool, onRemoveItem }: ItemsListProps) {
  if (items.length === 0) {
    return null;
  }

  const schoolCount = itemsBySchool.size;

  return (
    <div className="mb-6">
      <h4 className="text-sm font-medium text-gray-700 mb-3">
        Items del Encargo ({items.length})
        {schoolCount > 1 && (
          <span className="ml-2 text-sm font-normal text-blue-600">
            ({schoolCount} colegios)
          </span>
        )}
      </h4>

      {/* Items grouped by school */}
      <div className="space-y-4">
        {Array.from(itemsBySchool.entries()).map(([schoolId, schoolItems]) => (
          <SchoolItemsGroup
            key={schoolId}
            schoolId={schoolId}
            schoolItems={schoolItems}
            showSchoolHeader={schoolCount > 1}
            onRemoveItem={onRemoveItem}
          />
        ))}
      </div>

      {/* Multi-school note */}
      {schoolCount > 1 && (
        <p className="text-sm text-gray-500 mt-3">
          Se crearan {schoolCount} encargos separados (uno por colegio)
        </p>
      )}
    </div>
  );
}
