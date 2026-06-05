import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNotificationStore } from './notificationStore';

vi.mock('../services/notificationService', () => ({
  notificationService: {
    getAll: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  },
}));

import { notificationService } from '../services/notificationService';
const svcMock = vi.mocked(notificationService);

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    user_id: 'user-1',
    type: 'new_web_order' as const,
    title: 'Test',
    message: 'Test message',
    reference_type: null,
    reference_id: null,
    school_id: null,
    is_read: false,
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    act(() => {
      useNotificationStore.setState({
        notifications: [],
        unreadCount: 0,
        lastFetchedAt: null,
        isLoading: false,
        error: null,
        isPanelOpen: false,
      });
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has correct initial values', () => {
      const { result } = renderHook(() => useNotificationStore());
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.lastFetchedAt).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isPanelOpen).toBe(false);
    });
  });

  describe('fetchNotifications', () => {
    it('populates notifications and unread count on success', async () => {
      const notifications = [makeNotification(), makeNotification({ id: 'notif-2', is_read: true })];
      svcMock.getAll.mockResolvedValueOnce({ items: notifications, unread_count: 1 } as any);

      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.fetchNotifications(); });

      expect(result.current.notifications).toHaveLength(2);
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.lastFetchedAt).toBeInstanceOf(Date);
    });

    it('sets error state on failure', async () => {
      svcMock.getAll.mockRejectedValueOnce(new Error('Network'));
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.fetchNotifications(); });

      expect(result.current.error).toBe('Error al cargar notificaciones');
      expect(result.current.isLoading).toBe(false);
    });

    it('passes unreadOnly param to service', async () => {
      svcMock.getAll.mockResolvedValueOnce({ items: [], unread_count: 0 } as any);
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.fetchNotifications(true); });

      expect(svcMock.getAll).toHaveBeenCalledWith({ unread_only: true, limit: 50 });
    });
  });

  describe('fetchUnreadCount', () => {
    it('updates unreadCount on success', async () => {
      svcMock.getUnreadCount.mockResolvedValueOnce({ unread_count: 7 } as any);
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.fetchUnreadCount(); });

      expect(result.current.unreadCount).toBe(7);
    });

    it('silently fails on error (no error state set)', async () => {
      svcMock.getUnreadCount.mockRejectedValueOnce(new Error('Network'));
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.fetchUnreadCount(); });

      expect(result.current.error).toBeNull();
    });
  });

  describe('markAsRead', () => {
    it('marks notification as read and decrements unreadCount', async () => {
      const unread = makeNotification({ id: 'n1', is_read: false });
      act(() => {
        useNotificationStore.setState({ notifications: [unread], unreadCount: 3 });
      });

      svcMock.markAsRead.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.markAsRead('n1'); });

      const updated = result.current.notifications.find(n => n.id === 'n1');
      expect(updated?.is_read).toBe(true);
      expect(result.current.unreadCount).toBe(2);
    });

    it('only marks the targeted notification in a list of multiple', async () => {
      const n1 = makeNotification({ id: 'n1', is_read: false });
      const n2 = makeNotification({ id: 'n2', is_read: false });
      act(() => {
        useNotificationStore.setState({ notifications: [n1, n2], unreadCount: 2 });
      });

      svcMock.markAsRead.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.markAsRead('n1'); });

      expect(result.current.notifications.find(n => n.id === 'n1')?.is_read).toBe(true);
      expect(result.current.notifications.find(n => n.id === 'n2')?.is_read).toBe(false);
      expect(result.current.unreadCount).toBe(1);
    });

    it('does not decrement unreadCount for already-read notification', async () => {
      const alreadyRead = makeNotification({ id: 'n1', is_read: true });
      act(() => {
        useNotificationStore.setState({ notifications: [alreadyRead], unreadCount: 0 });
      });

      svcMock.markAsRead.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.markAsRead('n1'); });

      expect(result.current.unreadCount).toBe(0);
    });

    it('sets error state on failure', async () => {
      svcMock.markAsRead.mockRejectedValueOnce(new Error('Network'));
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.markAsRead('n1'); });

      expect(result.current.error).toBe('Error al marcar notificacion');
    });

    it('does not go below 0 for unreadCount', async () => {
      const unread = makeNotification({ id: 'n1', is_read: false });
      act(() => {
        useNotificationStore.setState({ notifications: [unread], unreadCount: 0 });
      });

      svcMock.markAsRead.mockResolvedValueOnce(undefined);
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.markAsRead('n1'); });

      expect(result.current.unreadCount).toBe(0); // Math.max(0, 0-1) = 0
    });
  });

  describe('markAllAsRead', () => {
    it('marks all notifications as read and sets unreadCount to 0', async () => {
      const notifications = [
        makeNotification({ id: 'n1', is_read: false }),
        makeNotification({ id: 'n2', is_read: false }),
      ];
      act(() => {
        useNotificationStore.setState({ notifications, unreadCount: 2 });
      });

      svcMock.markAllAsRead.mockResolvedValueOnce({ marked_count: 2 });
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.markAllAsRead(); });

      expect(result.current.notifications.every(n => n.is_read)).toBe(true);
      expect(result.current.unreadCount).toBe(0);
    });

    it('sets error state on failure', async () => {
      svcMock.markAllAsRead.mockRejectedValueOnce(new Error('Network'));
      const { result } = renderHook(() => useNotificationStore());
      await act(async () => { await result.current.markAllAsRead(); });

      expect(result.current.error).toBe('Error al marcar notificaciones');
    });
  });

  describe('panel controls', () => {
    it('setPanelOpen sets the panel state', () => {
      const { result } = renderHook(() => useNotificationStore());
      act(() => { result.current.setPanelOpen(true); });
      expect(result.current.isPanelOpen).toBe(true);

      act(() => { result.current.setPanelOpen(false); });
      expect(result.current.isPanelOpen).toBe(false);
    });

    it('togglePanel flips the panel state', () => {
      const { result } = renderHook(() => useNotificationStore());
      act(() => { result.current.togglePanel(); });
      expect(result.current.isPanelOpen).toBe(true);

      act(() => { result.current.togglePanel(); });
      expect(result.current.isPanelOpen).toBe(false);
    });
  });

  describe('clearError', () => {
    it('resets error to null', () => {
      act(() => {
        useNotificationStore.setState({ error: 'some error' });
      });
      const { result } = renderHook(() => useNotificationStore());
      act(() => { result.current.clearError(); });
      expect(result.current.error).toBeNull();
    });
  });
});
