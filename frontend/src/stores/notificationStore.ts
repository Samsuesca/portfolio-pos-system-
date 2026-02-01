/**
 * Notification Store - Zustand store for managing notifications state
 */
import { create } from 'zustand';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../types/api';

interface NotificationState {
  // State
  notifications: Notification[];
  unreadCount: number;
  lastFetchedAt: Date | null;
  isLoading: boolean;
  error: string | null;
  isPanelOpen: boolean;

  // Actions
  fetchNotifications: (unreadOnly?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  // Initial state
  notifications: [],
  unreadCount: 0,
  lastFetchedAt: null,
  isLoading: false,
  error: null,
  isPanelOpen: false,

  // Fetch all notifications
  fetchNotifications: async (unreadOnly = false) => {
    set({ isLoading: true, error: null });
    try {
      const response = await notificationService.getAll({
        unread_only: unreadOnly,
        limit: 50
      });
      set({
        notifications: response.items,
        unreadCount: response.unread_count,
        lastFetchedAt: new Date(),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: 'Error al cargar notificaciones',
        isLoading: false,
      });
    }
  },

  // Fetch only unread count (lightweight for polling)
  fetchUnreadCount: async () => {
    try {
      const response = await notificationService.getUnreadCount();
      set({ unreadCount: response.unread_count });
    } catch (error) {
      // Silently fail for polling - don't disrupt UX
      console.error('Error fetching notification count:', error);
    }
  },

  // Mark single notification as read
  markAsRead: async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);

      // Update local state
      const { notifications, unreadCount } = get();
      const notification = notifications.find(n => n.id === notificationId);

      if (notification && !notification.is_read) {
        set({
          notifications: notifications.map(n =>
            n.id === notificationId
              ? { ...n, is_read: true, read_at: new Date().toISOString() }
              : n
          ),
          unreadCount: Math.max(0, unreadCount - 1),
        });
      }
    } catch (error) {
      set({ error: 'Error al marcar notificacion' });
    }
  },

  // Mark all as read
  markAllAsRead: async () => {
    try {
      await notificationService.markAllAsRead();

      // Update local state
      const { notifications } = get();
      set({
        notifications: notifications.map(n => ({
          ...n,
          is_read: true,
          read_at: n.read_at || new Date().toISOString(),
        })),
        unreadCount: 0,
      });
    } catch (error) {
      set({ error: 'Error al marcar notificaciones' });
    }
  },

  // Panel controls
  setPanelOpen: (open: boolean) => set({ isPanelOpen: open }),
  togglePanel: () => set(state => ({ isPanelOpen: !state.isPanelOpen })),
  clearError: () => set({ error: null }),
}));
