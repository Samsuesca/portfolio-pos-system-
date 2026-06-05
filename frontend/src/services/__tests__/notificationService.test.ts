import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import notificationService from '../notificationService';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('fetches all notifications with no filters', async () => {
      const mockResponse = { items: [], total: 0, unread_count: 0 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockResponse });

      const result = await notificationService.getAll();

      expect(apiMock.get).toHaveBeenCalledWith('/notifications');
      expect(result).toEqual(mockResponse);
    });

    it('appends unread_only=true when set', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { items: [], total: 0, unread_count: 0 } });

      await notificationService.getAll({ unread_only: true });

      expect(apiMock.get).toHaveBeenCalledWith('/notifications?unread_only=true');
    });

    it('appends limit and skip', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { items: [], total: 0, unread_count: 0 } });

      await notificationService.getAll({ limit: 10, skip: 20 });

      expect(apiMock.get).toHaveBeenCalledWith('/notifications?limit=10&skip=20');
    });

    it('does not append falsy unread_only', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { items: [], total: 0, unread_count: 0 } });

      await notificationService.getAll({ unread_only: false });

      expect(apiMock.get).toHaveBeenCalledWith('/notifications');
    });
  });

  describe('getUnreadCount', () => {
    it('fetches unread count from dedicated endpoint', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { unread_count: 5, last_notification_at: null } });

      const result = await notificationService.getUnreadCount();

      expect(apiMock.get).toHaveBeenCalledWith('/notifications/unread-count');
      expect(result.unread_count).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('patches single notification as read', async () => {
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: undefined });

      await notificationService.markAsRead('notif-1');

      expect(apiMock.patch).toHaveBeenCalledWith('/notifications/notif-1/read');
    });
  });

  describe('markAllAsRead', () => {
    it('patches all with empty body when no IDs provided', async () => {
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { success: true, marked_count: 3 } });

      const result = await notificationService.markAllAsRead();

      expect(apiMock.patch).toHaveBeenCalledWith('/notifications/mark-all-read', {});
      expect(result.marked_count).toBe(3);
    });

    it('patches with notification_ids when provided', async () => {
      (apiMock.patch as Mock).mockResolvedValueOnce({ data: { success: true, marked_count: 2 } });

      const result = await notificationService.markAllAsRead(['notif-1', 'notif-2']);

      expect(apiMock.patch).toHaveBeenCalledWith(
        '/notifications/mark-all-read',
        { notification_ids: ['notif-1', 'notif-2'] }
      );
      expect(result.marked_count).toBe(2);
    });
  });

  describe('error propagation', () => {
    it('propagates errors from getAll', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(notificationService.getAll()).rejects.toThrow('Unauthorized');
    });
  });
});
