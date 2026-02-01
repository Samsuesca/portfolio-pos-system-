/**
 * useNotifications Hook
 *
 * Provides notification functionality with automatic polling.
 * Polls for unread count every 30 seconds when the app is active.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '../stores/notificationStore';
import { useAuthStore } from '../stores/authStore';

const POLLING_INTERVAL = 30000; // 30 seconds

export function useNotifications() {
  const { isAuthenticated } = useAuthStore();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    isPanelOpen,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    setPanelOpen,
    togglePanel,
    clearError,
  } = useNotificationStore();

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start polling when authenticated
  const startPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    // Initial fetch
    fetchUnreadCount();

    // Start interval
    pollingRef.current = setInterval(() => {
      fetchUnreadCount();
    }, POLLING_INTERVAL);
  }, [fetchUnreadCount]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Handle authentication changes
  useEffect(() => {
    if (isAuthenticated) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [isAuthenticated, startPolling, stopPolling]);

  // Handle visibility changes (pause polling when tab is hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (isAuthenticated) {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, startPolling, stopPolling]);

  // Open panel and fetch full notifications
  const openPanel = useCallback(() => {
    setPanelOpen(true);
    fetchNotifications();
  }, [setPanelOpen, fetchNotifications]);

  // Close panel
  const closePanel = useCallback(() => {
    setPanelOpen(false);
  }, [setPanelOpen]);

  return {
    // State
    notifications,
    unreadCount,
    isLoading,
    error,
    isPanelOpen,

    // Actions
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    openPanel,
    closePanel,
    togglePanel,
    clearError,
  };
}
