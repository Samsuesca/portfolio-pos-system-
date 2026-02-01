/**
 * Order Change Service - API calls for order changes/returns (encargos)
 */
import apiClient from '../utils/api-client';
import type { OrderChange, OrderChangeCreate, OrderChangeListItem } from '../types/api';

export interface OrderChangeFilters {
  status?: 'pending' | 'pending_stock' | 'approved' | 'rejected';
  change_type?: 'size_change' | 'product_change' | 'return' | 'defect';
  limit?: number;
}

export const orderChangeService = {
  /**
   * Get all order changes from all schools (global endpoint)
   */
  async getAllChanges(filters?: OrderChangeFilters): Promise<OrderChangeListItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.change_type) params.append('change_type', filters.change_type);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/order-changes?${queryString}` : '/order-changes';
    const response = await apiClient.get<OrderChangeListItem[]>(url);
    return response.data;
  },

  /**
   * Create a new order change request
   */
  async createChange(
    schoolId: string,
    orderId: string,
    data: OrderChangeCreate
  ): Promise<OrderChange> {
    const response = await apiClient.post<OrderChange>(
      `/schools/${schoolId}/orders/${orderId}/changes`,
      data
    );
    return response.data;
  },

  /**
   * Get all changes for a specific order
   */
  async getOrderChanges(schoolId: string, orderId: string): Promise<OrderChange[]> {
    const response = await apiClient.get<OrderChange[]>(
      `/schools/${schoolId}/orders/${orderId}/changes`
    );
    return response.data;
  },

  /**
   * Approve an order change request (ADMIN only)
   */
  async approveChange(
    schoolId: string,
    orderId: string,
    changeId: string,
    paymentMethod?: 'cash' | 'nequi' | 'transfer' | 'card'
  ): Promise<OrderChange> {
    const data = paymentMethod ? { payment_method: paymentMethod } : undefined;
    const response = await apiClient.patch<OrderChange>(
      `/schools/${schoolId}/orders/${orderId}/changes/${changeId}/approve`,
      data
    );
    return response.data;
  },

  /**
   * Reject an order change request (ADMIN only)
   */
  async rejectChange(
    schoolId: string,
    orderId: string,
    changeId: string,
    rejectionReason: string
  ): Promise<OrderChange> {
    const response = await apiClient.patch<OrderChange>(
      `/schools/${schoolId}/orders/${orderId}/changes/${changeId}/reject`,
      { rejection_reason: rejectionReason }
    );
    return response.data;
  },
};
