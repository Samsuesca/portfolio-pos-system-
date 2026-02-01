/**
 * UpcomingOrdersWidget - Shows orders with upcoming delivery dates
 */
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, CheckCircle, DollarSign } from 'lucide-react';
import type { OrderListItem } from '../../types/api';
import { DashboardWidget } from './DashboardWidget';
import { formatCurrency } from '../../utils/formatting';

interface UpcomingOrdersWidgetProps {
  orders: OrderListItem[];
  loading?: boolean;
}

type UrgencyLevel = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later';

function getUrgencyLevel(deliveryDate: string | null): UrgencyLevel {
  if (!deliveryDate) return 'later';

  const delivery = new Date(deliveryDate);
  delivery.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const endOfWeek = new Date(today);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  if (delivery < today) return 'overdue';
  if (delivery.getTime() === today.getTime()) return 'today';
  if (delivery.getTime() === tomorrow.getTime()) return 'tomorrow';
  if (delivery <= endOfWeek) return 'this_week';
  return 'later';
}

function getUrgencyStyles(level: UrgencyLevel): { bg: string; text: string; border: string; badge: string } {
  switch (level) {
    case 'overdue':
      return {
        bg: 'bg-red-50 hover:bg-red-100',
        text: 'text-red-800',
        border: 'border-l-4 border-red-500',
        badge: 'bg-red-100 text-red-800',
      };
    case 'today':
      return {
        bg: 'bg-orange-50 hover:bg-orange-100',
        text: 'text-orange-800',
        border: 'border-l-4 border-orange-500',
        badge: 'bg-orange-100 text-orange-800',
      };
    case 'tomorrow':
      return {
        bg: 'bg-amber-50 hover:bg-amber-100',
        text: 'text-amber-800',
        border: 'border-l-4 border-amber-400',
        badge: 'bg-amber-100 text-amber-800',
      };
    case 'this_week':
      return {
        bg: 'bg-blue-50 hover:bg-blue-100',
        text: 'text-blue-800',
        border: 'border-l-4 border-blue-400',
        badge: 'bg-blue-100 text-blue-800',
      };
    default:
      return {
        bg: 'hover:bg-slate-50',
        text: 'text-slate-700',
        border: '',
        badge: 'bg-slate-100 text-slate-600',
      };
  }
}

function getUrgencyLabel(level: UrgencyLevel): string {
  switch (level) {
    case 'overdue':
      return 'Vencido';
    case 'today':
      return 'Hoy';
    case 'tomorrow':
      return 'Mañana';
    case 'this_week':
      return 'Esta semana';
    default:
      return '';
  }
}

function formatDeliveryDate(dateString: string | null): string {
  if (!dateString) return 'Sin fecha';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

export function UpcomingOrdersWidget({ orders, loading = false }: UpcomingOrdersWidgetProps) {
  const navigate = useNavigate();

  // Filter and sort orders by delivery urgency
  const sortedOrders = [...orders]
    .filter((order) => ['pending', 'in_production', 'ready'].includes(order.status))
    .sort((a, b) => {
      if (!a.delivery_date && !b.delivery_date) return 0;
      if (!a.delivery_date) return 1;
      if (!b.delivery_date) return -1;
      return new Date(a.delivery_date).getTime() - new Date(b.delivery_date).getTime();
    })
    .slice(0, 5);

  const hasOrders = sortedOrders.length > 0;

  return (
    <DashboardWidget
      title="Encargos Próximos"
      icon={Clock}
      iconColor="text-orange-600"
      headerAction={{
        label: 'Ver todos',
        onClick: () => navigate('/orders'),
      }}
      loading={loading}
      emptyState={
        hasOrders
          ? undefined
          : {
              icon: CheckCircle,
              message: 'No hay encargos pendientes',
              submessage: 'Todo al día',
            }
      }
    >
      {hasOrders && (
        <div className="space-y-2">
          {sortedOrders.map((order) => {
            const urgency = getUrgencyLevel(order.delivery_date);
            const styles = getUrgencyStyles(urgency);
            const urgencyLabel = getUrgencyLabel(urgency);
            const isPaid = order.balance <= 0;

            return (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className={`py-3 px-3 rounded-lg cursor-pointer transition-colors ${styles.bg} ${styles.border}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-800">{order.code}</span>
                      {urgencyLabel && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles.badge}`}>
                          {urgency === 'overdue' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {urgencyLabel}
                        </span>
                      )}
                      {order.school_name && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {order.school_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-0.5">
                      {order.client_name || order.student_name || 'Sin cliente'}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{order.items_count} item{order.items_count !== 1 ? 's' : ''}</span>
                      <span>Entrega: {formatDeliveryDate(order.delivery_date)}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {isPaid ? (
                      <span className="inline-flex items-center text-xs text-green-600 font-medium">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />
                        Pagado
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-amber-600 font-medium">
                        <DollarSign className="w-3.5 h-3.5" />
                        {formatCurrency(order.balance)} pend.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardWidget>
  );
}

export default UpcomingOrdersWidget;
