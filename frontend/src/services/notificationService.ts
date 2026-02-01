/**
 * Notification Service - API calls for notifications
 */
import apiClient from '../utils/api-client';
import type {
  NotificationListResponse,
  UnreadCountResponse
} from '../types/api';

export interface NotificationFilters {
  unread_only?: boolean;
  limit?: number;
  offset?: number;
}

export const notificationService = {
  /**
   * Get notifications for current user
   */
  async getAll(filters?: NotificationFilters): Promise<NotificationListResponse> {
    const params = new URLSearchParams();
    if (filters?.unread_only) params.append('unread_only', 'true');
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.offset) params.append('offset', String(filters.offset));

    const queryString = params.toString();
    const url = queryString ? `/notifications?${queryString}` : '/notifications';
    const response = await apiClient.get<NotificationListResponse>(url);
    return response.data;
  },

  /**
   * Get unread notification count (optimized for polling)
   */
  async getUnreadCount(): Promise<UnreadCountResponse> {
    const response = await apiClient.get<UnreadCountResponse>('/notifications/unread-count');
    return response.data;
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  },

  /**
   * Mark all notifications as read
   * If notificationIds provided, marks only those
   */
  async markAllAsRead(notificationIds?: string[]): Promise<{ marked_count: number }> {
    const response = await apiClient.patch<{ success: boolean; marked_count: number }>(
      '/notifications/mark-all-read',
      notificationIds ? { notification_ids: notificationIds } : {}
    );
    return response.data;
  },
};

export default notificationService;
