/**
 * Product Demand Modal
 * Shows orders containing a specific product (garment_type + size + color)
 *
 * Features:
 * - List of orders with this product grouped by status
 * - Status indicators for each order and item
 * - Click to navigate to order detail
 * - Yomber measurements display
 */
import { useMemo } from 'react';
import { X, Package, Clock, Wrench, CheckCircle, Calendar, ArrowRight, Ruler, Building2, Globe } from 'lucide-react';
import { formatDateSpanish } from './DatePicker';
import type { ProductDemandItem, OrderReference } from '../types/api';

interface ProductDemandModalProps {
  isOpen: boolean;
  onClose: () => void;
  demandItem: ProductDemandItem | null;
  onNavigateToOrder: (orderId: string, schoolId: string) => void;
}

// Measurement labels in Spanish
const measurementLabels: Record<string, string> = {
  delantero: 'Delantero',
  trasero: 'Trasero',
  cintura: 'Cintura',
  largo: 'Largo',
  espalda: 'Espalda',
  cadera: 'Cadera',
  hombro: 'Hombro',
  pierna: 'Pierna',
  entrepierna: 'Entrepierna',
  manga: 'Manga',
  cuello: 'Cuello',
  pecho: 'Pecho',
  busto: 'Busto',
  tiro: 'Tiro',
};

export default function ProductDemandModal({
  isOpen,
  onClose,
  demandItem,
  onNavigateToOrder,
}: ProductDemandModalProps) {
  // Group orders by item status
  const groupedOrders = useMemo(() => {
    if (!demandItem) return { pending: [], in_production: [], ready: [] };

    const groups: Record<string, OrderReference[]> = {
      pending: [],
      in_production: [],
      ready: [],
    };

    for (const order of demandItem.orders) {
      if (order.item_status === 'pending') groups.pending.push(order);
      else if (order.item_status === 'in_production') groups.in_production.push(order);
      else if (order.item_status === 'ready') groups.ready.push(order);
    }

    return groups;
  }, [demandItem]);

  if (!isOpen || !demandItem) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-purple-800 flex items-center">
                  <Package className="w-6 h-6 mr-2" />
                  {demandItem.garment_type_name}
                </h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {demandItem.garment_type_category && (
                    <span className="text-sm text-gray-500">
                      {demandItem.garment_type_category}
                    </span>
                  )}
                  {demandItem.size && (
                    <span className="text-sm bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                      Talla: {demandItem.size}
                    </span>
                  )}
                  {demandItem.color && (
                    <span className="text-sm bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                      {demandItem.color}
                    </span>
                  )}
                  {demandItem.is_yomber && (
                    <span className="text-sm bg-purple-100 text-purple-700 px-2 py-0.5 rounded flex items-center">
                      <Ruler className="w-3 h-3 mr-1" />
                      Yomber
                    </span>
                  )}
                  {demandItem.is_global_product && (
                    <span className="text-sm bg-blue-100 text-blue-700 px-2 py-0.5 rounded flex items-center">
                      <Globe className="w-3 h-3 mr-1" />
                      Producto Global
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-white rounded-lg p-3 text-center shadow-sm">
                <p className="text-sm text-gray-500">Total</p>
                <p className="text-2xl font-bold text-gray-900">{demandItem.total_quantity}</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-sm text-yellow-700">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-900">{demandItem.pending_quantity}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-sm text-blue-700">En Produccion</p>
                <p className="text-2xl font-bold text-blue-900">{demandItem.in_production_quantity}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-sm text-green-700">Listos</p>
                <p className="text-2xl font-bold text-green-900">{demandItem.ready_quantity}</p>
              </div>
            </div>
          </div>

          {/* Content - Order List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Pending Orders Section */}
            {groupedOrders.pending.length > 0 && (
              <OrderSection
                title="Pendientes"
                icon={<Clock className="w-5 h-5 text-yellow-600" />}
                orders={groupedOrders.pending}
                bgColor="bg-yellow-50"
                borderColor="border-yellow-200"
                isYomber={demandItem.is_yomber}
                onNavigateToOrder={onNavigateToOrder}
              />
            )}

            {/* In Production Section */}
            {groupedOrders.in_production.length > 0 && (
              <OrderSection
                title="En Produccion"
                icon={<Wrench className="w-5 h-5 text-blue-600" />}
                orders={groupedOrders.in_production}
                bgColor="bg-blue-50"
                borderColor="border-blue-200"
                isYomber={demandItem.is_yomber}
                onNavigateToOrder={onNavigateToOrder}
              />
            )}

            {/* Ready Section */}
            {groupedOrders.ready.length > 0 && (
              <OrderSection
                title="Listos para Entrega"
                icon={<CheckCircle className="w-5 h-5 text-green-600" />}
                orders={groupedOrders.ready}
                bgColor="bg-green-50"
                borderColor="border-green-200"
                isYomber={demandItem.is_yomber}
                onNavigateToOrder={onNavigateToOrder}
              />
            )}

            {/* Empty state */}
            {groupedOrders.pending.length === 0 &&
             groupedOrders.in_production.length === 0 &&
             groupedOrders.ready.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No hay encargos activos para este producto.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <div className="text-sm text-gray-500 flex items-center gap-4">
              <span>{demandItem.order_count} encargos</span>
              <span className="flex items-center">
                <Building2 className="w-4 h-4 mr-1" />
                {demandItem.school_names.join(', ')}
              </span>
              {demandItem.earliest_delivery_date && (
                <span className="flex items-center text-orange-600">
                  <Calendar className="w-4 h-4 mr-1" />
                  Proxima entrega: {formatDateSpanish(demandItem.earliest_delivery_date)}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component for order sections
interface OrderSectionProps {
  title: string;
  icon: React.ReactNode;
  orders: OrderReference[];
  bgColor: string;
  borderColor: string;
  isYomber: boolean;
  onNavigateToOrder: (orderId: string, schoolId: string) => void;
}

function OrderSection({
  title,
  icon,
  orders,
  bgColor,
  borderColor,
  isYomber,
  onNavigateToOrder,
}: OrderSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 flex items-center mb-3">
        {icon}
        <span className="ml-2">{title}</span>
        <span className="ml-2 text-gray-400">({orders.length})</span>
      </h3>
      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={`${order.order_id}-${order.item_id}`}
            className={`${bgColor} border ${borderColor} rounded-lg p-4 hover:shadow-md transition cursor-pointer`}
            onClick={() => onNavigateToOrder(order.order_id, order.school_id || '')}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-gray-800">{order.order_code}</span>
                  <span className="text-sm text-gray-500">x{order.quantity}</span>
                </div>
                <p className="text-sm text-gray-700">
                  {order.client_name}
                  {order.student_name && (
                    <span className="text-gray-500"> ({order.student_name})</span>
                  )}
                </p>
                {order.school_name && (
                  <p className="text-xs text-gray-500 flex items-center mt-1">
                    <Building2 className="w-3 h-3 mr-1" />
                    {order.school_name}
                  </p>
                )}
              </div>
              <div className="text-right">
                {order.delivery_date && (
                  <p className="text-sm text-gray-600 flex items-center justify-end">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDateSpanish(order.delivery_date)}
                  </p>
                )}
                <button className="text-sm text-purple-600 hover:text-purple-800 flex items-center mt-2">
                  Ver encargo <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>

            {/* Yomber Measurements */}
            {isYomber && order.custom_measurements && Object.keys(order.custom_measurements).length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-purple-600 uppercase font-medium mb-2">Medidas</p>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(order.custom_measurements).map(([key, value]) => (
                    <div key={key} className="bg-white rounded px-2 py-1 text-center">
                      <span className="text-xs text-gray-500 block">
                        {measurementLabels[key] || key}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
