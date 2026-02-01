/**
 * NotificationPanel Component
 *
 * Dropdown panel showing list of notifications.
 * Appears when clicking the notification bell.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Bell,
  Check,
  CheckCheck,
  ShoppingCart,
  FileText,
  Package,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification, NotificationType } from '../types/api';

// Icon mapping for notification types
const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  new_web_order: FileText,
  new_web_sale: ShoppingCart,
  order_status_changed: Package,
  pqrs_received: MessageSquare,
  low_stock_alert: AlertTriangle,
};

// Color mapping for notification types
const TYPE_COLORS: Record<NotificationType, string> = {
  new_web_order: 'bg-blue-100 text-blue-600',
  new_web_sale: 'bg-green-100 text-green-600',
  order_status_changed: 'bg-purple-100 text-purple-600',
  pqrs_received: 'bg-orange-100 text-orange-600',
  low_stock_alert: 'bg-amber-100 text-amber-600',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `Hace ${diffMins}m`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onClick: (notification: Notification) => void;
}

function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const Icon = TYPE_ICONS[notification.type] || Bell;
  const colorClass = TYPE_COLORS[notification.type] || 'bg-gray-100 text-gray-600';

  return (
    <div
      className={`flex items-start gap-3 p-3 hover:bg-surface-50 cursor-pointer transition-colors ${
        !notification.is_read ? 'bg-blue-50/50' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${!notification.is_read ? 'font-semibold' : 'font-medium'} text-gray-900 truncate`}>
            {notification.title}
          </p>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatTimeAgo(notification.created_at)}
          </span>
        </div>
        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
          {notification.message}
        </p>
      </div>

      {!notification.is_read && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRead(notification.id);
          }}
          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
          title="Marcar como leida"
        >
          <Check className="w-4 h-4 text-gray-500" />
        </button>
      )}
    </div>
  );
}

export function NotificationPanel() {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    isPanelOpen,
    closePanel,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closePanel();
      }
    }

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen, closePanel]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closePanel();
      }
    }

    if (isPanelOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isPanelOpen, closePanel]);

  // Handle notification click - navigate to referenced entity
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }

    // Navigate based on reference type
    if (notification.reference_type && notification.reference_id) {
      switch (notification.reference_type) {
        case 'order':
          // Navigate to web-orders if it's a web order, otherwise orders
          if (notification.type === 'new_web_order') {
            navigate('/web-orders');
          } else {
            navigate(`/orders/${notification.reference_id}`);
          }
          break;
        case 'sale':
          navigate(`/sales/${notification.reference_id}`);
          break;
        case 'contact':
          navigate('/contacts');
          break;
        case 'product':
          // Navigate to products/inventory page
          navigate('/products');
          break;
      }
    }

    closePanel();
  };

  if (!isPanelOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={closePanel} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-12 w-96 max-h-[calc(100vh-100px)] bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Notificaciones</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded-full">
                {unreadCount} nuevas
              </span>
            )}
          </div>
          <button
            onClick={closePanel}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Mark all as read button */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <CheckCheck className="w-4 h-4" />
              Marcar todas como leidas
            </button>
          </div>
        )}

        {/* Notifications list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">Sin notificaciones</p>
              <p className="text-sm text-gray-400 mt-1">
                Las notificaciones apareceran aqui
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
