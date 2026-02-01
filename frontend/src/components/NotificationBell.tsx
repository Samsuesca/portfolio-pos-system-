/**
 * NotificationBell Component
 *
 * Bell icon with badge showing unread notification count.
 * Clicking opens the notification panel.
 */
import { Bell } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';

export function NotificationBell() {
  const { unreadCount, openPanel } = useNotifications();

  return (
    <button
      onClick={openPanel}
      className="relative p-2 rounded-lg hover:bg-surface-100 text-slate-600 transition-colors"
      title={`${unreadCount} notificaciones sin leer`}
    >
      <Bell className="w-5 h-5" />

      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
