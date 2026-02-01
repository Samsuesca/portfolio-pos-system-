/**
 * UrgentAlertsSection - Expanded list of urgent alerts (orders due today/tomorrow, critical stock)
 */
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  Package,
  ChevronRight,
  CheckCircle,
  DollarSign,
  Scissors,
} from 'lucide-react';
import type { OrderListItem, Product } from '../../types/api';
import { formatCurrency } from '../../utils/formatting';

export interface UrgentOrderAlert {
  id: string;
  code: string;
  client_name: string;
  items_summary: string;
  balance: number;
  delivery_date: string | null;
  is_overdue: boolean;
}

export interface AlertsData {
  orders_today: UrgentOrderAlert[];
  orders_tomorrow: UrgentOrderAlert[];
  orders_overdue: UrgentOrderAlert[];
  critical_stock_count: number;
  out_of_stock_products: Product[];
  out_of_stock_count: number;  // Real count of products with 0 stock
  low_stock_count: number;     // Real count of products with low stock
  alterations_ready?: number;
}

interface UrgentAlertsSectionProps {
  data: AlertsData;
  /** Show alterations alerts (requires alterations.view permission) */
  showAlterationAlerts?: boolean;
  /** Show order alerts (requires orders.view permission) */
  showOrderAlerts?: boolean;
  /** Show stock alerts (requires inventory.view permission) */
  showStockAlerts?: boolean;
  loading?: boolean;
}

// Convert OrderListItem to UrgentOrderAlert
export function processOrdersForAlerts(orders: OrderListItem[]): {
  overdue: UrgentOrderAlert[];
  today: UrgentOrderAlert[];
  tomorrow: UrgentOrderAlert[];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const overdue: UrgentOrderAlert[] = [];
  const todayOrders: UrgentOrderAlert[] = [];
  const tomorrowOrders: UrgentOrderAlert[] = [];

  orders
    .filter((order) => ['pending', 'in_production', 'ready'].includes(order.status))
    .forEach((order) => {
      if (!order.delivery_date) return;

      const deliveryDate = new Date(order.delivery_date);
      deliveryDate.setHours(0, 0, 0, 0);

      const alert: UrgentOrderAlert = {
        id: order.id,
        code: order.code,
        client_name: order.client_name || order.student_name || 'Sin cliente',
        items_summary: `${order.items_count} item${order.items_count !== 1 ? 's' : ''}`,
        balance: order.balance,
        delivery_date: order.delivery_date,
        is_overdue: deliveryDate < today,
      };

      if (deliveryDate < today) {
        overdue.push(alert);
      } else if (deliveryDate.getTime() === today.getTime()) {
        todayOrders.push(alert);
      } else if (deliveryDate.getTime() === tomorrow.getTime()) {
        tomorrowOrders.push(alert);
      }
    });

  return {
    overdue: overdue.slice(0, 5),
    today: todayOrders.slice(0, 5),
    tomorrow: tomorrowOrders.slice(0, 5),
  };
}

// Process products for critical stock (consistent with Products.tsx logic)
export function processCriticalStock(products: Product[]): {
  outOfStock: Product[];
  outOfStockCount: number;
  lowStockCount: number;
  criticalCount: number;
} {
  const outOfStock = products.filter((p) => {
    // Use same logic as Products.tsx: check both stock and inventory_quantity
    const stock = (p as any).stock ?? p.inventory_quantity ?? 0;
    return stock === 0;
  });

  const lowStock = products.filter((p) => {
    // Use same logic as Products.tsx: check both stock and inventory_quantity
    const stock = (p as any).stock ?? p.inventory_quantity ?? 0;
    const minStock = (p as any).min_stock ?? p.inventory_min_stock ?? 5;
    return stock > 0 && stock <= minStock;
  });

  return {
    outOfStock: outOfStock.slice(0, 3), // Only first 3 for display
    outOfStockCount: outOfStock.length, // Real count
    lowStockCount: lowStock.length,     // Real count
    criticalCount: outOfStock.length + lowStock.length,
  };
}

function OrderAlertItem({
  alert,
  onClick,
}: {
  alert: UrgentOrderAlert;
  onClick: () => void;
}) {
  const isPaid = alert.balance <= 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/50 cursor-pointer transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex-shrink-0">
          <Clock className="w-4 h-4 text-current opacity-60" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{alert.code}</span>
            <span className="text-xs opacity-75">-</span>
            <span className="text-sm truncate">{alert.client_name}</span>
          </div>
          <span className="text-xs opacity-75">{alert.items_summary}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isPaid ? (
          <span className="inline-flex items-center text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle className="w-3 h-3 mr-1" />
            Pagado
          </span>
        ) : (
          <span className="inline-flex items-center text-xs font-medium bg-white/50 px-2 py-0.5 rounded-full">
            <DollarSign className="w-3 h-3" />
            {formatCurrency(alert.balance)}
          </span>
        )}
        <ChevronRight className="w-4 h-4 opacity-40" />
      </div>
    </div>
  );
}

export function UrgentAlertsSection({
  data,
  showAlterationAlerts = false,
  showOrderAlerts = true,
  showStockAlerts = true,
  loading = false,
}: UrgentAlertsSectionProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="mb-6 space-y-3">
        <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Apply permission filters to determine what to show
  const hasOverdue = showOrderAlerts && data.orders_overdue.length > 0;
  const hasToday = showOrderAlerts && data.orders_today.length > 0;
  const hasTomorrow = showOrderAlerts && data.orders_tomorrow.length > 0;
  const hasStockIssues = showStockAlerts && data.critical_stock_count > 0;
  const hasAlterationsReady = showAlterationAlerts && (data.alterations_ready ?? 0) > 0;

  const hasAnyAlert = hasOverdue || hasToday || hasTomorrow || hasStockIssues || hasAlterationsReady;

  if (!hasAnyAlert) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Overdue Orders - Red, most urgent */}
      {hasOverdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-red-800">
              Encargos Vencidos ({data.orders_overdue.length})
            </h4>
          </div>
          <div className="space-y-1 text-red-800">
            {data.orders_overdue.map((alert) => (
              <OrderAlertItem
                key={alert.id}
                alert={alert}
                onClick={() => navigate(`/orders/${alert.id}`)}
              />
            ))}
          </div>
          <button
            onClick={() => navigate('/orders?filter=overdue')}
            className="mt-3 text-sm text-red-700 hover:text-red-800 font-medium flex items-center gap-1"
          >
            Ver todos los vencidos
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Today's Orders - Orange */}
      {hasToday && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold text-orange-800">
              Entregas HOY ({data.orders_today.length})
            </h4>
          </div>
          <div className="space-y-1 text-orange-800">
            {data.orders_today.map((alert) => (
              <OrderAlertItem
                key={alert.id}
                alert={alert}
                onClick={() => navigate(`/orders/${alert.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Tomorrow's Orders - Amber */}
      {hasTomorrow && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-amber-800">
              Entregas MAÑANA ({data.orders_tomorrow.length})
            </h4>
          </div>
          <div className="space-y-1 text-amber-800">
            {data.orders_tomorrow.map((alert) => (
              <OrderAlertItem
                key={alert.id}
                alert={alert}
                onClick={() => navigate(`/orders/${alert.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Critical Stock Alert */}
      {hasStockIssues && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-yellow-600" />
              <h4 className="font-semibold text-yellow-800">
                Stock Critico
              </h4>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="text-sm text-yellow-700 hover:text-yellow-800 font-medium flex items-center gap-1"
            >
              Ver productos
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.out_of_stock_count > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                {data.out_of_stock_count} sin stock
              </span>
            )}
            {data.low_stock_count > 0 && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                {data.low_stock_count} con stock bajo
              </span>
            )}
          </div>
        </div>
      )}

      {/* Alterations Ready */}
      {hasAlterationsReady && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-800">
                {data.alterations_ready} arreglo{data.alterations_ready !== 1 ? 's' : ''} listo{data.alterations_ready !== 1 ? 's' : ''} para entregar
              </h4>
            </div>
            <button
              onClick={() => navigate('/alterations')}
              className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
            >
              Ver arreglos
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UrgentAlertsSection;
