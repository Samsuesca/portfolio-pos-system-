/**
 * Order Changes Service - API calls for order changes/returns (encargos)
 * Used for managing change requests from web orders and desktop orders
 */
import apiClient from '../api';
import type { PaymentMethod } from '../api';

export type ChangeType = 'size_change' | 'product_change' | 'return' | 'defect';
export type ChangeStatus = 'pending' | 'pending_stock' | 'approved' | 'rejected';

export interface OrderChangeListItem {
  id: string;
  order_id: string;
  order_code: string;
  school_id: string;
  school_name: string;
  original_item_id: string;
  change_type: ChangeType;
  change_date: string;
  returned_quantity: number;
  new_product_id: string | null;
  new_quantity: number;
  new_unit_price: number | null;
  new_size: string | null;
  new_color: string | null;
  price_adjustment: number;
  status: ChangeStatus;
  reason: string;
  rejection_reason: string | null;
  user_id: string;
  user_name: string | null;
}

export interface OrderChange {
  id: string;
  order_id: string;
  original_item_id: string;
  user_id: string;
  change_type: ChangeType;
  change_date: string;
  returned_quantity: number;
  new_product_id: string | null;
  new_global_product_id: string | null;
  is_new_global_product: boolean;
  new_quantity: number;
  new_unit_price: number | null;
  new_size: string | null;
  new_color: string | null;
  new_custom_measurements: Record<string, number> | null;
  new_embroidery_text: string | null;
  price_adjustment: number;
  status: ChangeStatus;
  reason: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderChangeFilters {
  status?: ChangeStatus;
  change_type?: ChangeType;
  limit?: number;
}

const orderChangesService = {
  /**
   * Get all order changes from all schools (global endpoint)
   * This is the primary endpoint for the admin portal
   */
  getAllChanges: async (filters?: OrderChangeFilters): Promise<OrderChangeListItem[]> => {
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
   * Get changes for a specific order
   */
  getOrderChanges: async (schoolId: string, orderId: string): Promise<OrderChange[]> => {
    const response = await apiClient.get<OrderChange[]>(
      `/schools/${schoolId}/orders/${orderId}/changes`
    );
    return response.data;
  },

  /**
   * Approve an order change request (ADMIN only)
   */
  approveChange: async (
    schoolId: string,
    orderId: string,
    changeId: string,
    paymentMethod?: PaymentMethod
  ): Promise<OrderChange> => {
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
  rejectChange: async (
    schoolId: string,
    orderId: string,
    changeId: string,
    rejectionReason: string
  ): Promise<OrderChange> => {
    const response = await apiClient.patch<OrderChange>(
      `/schools/${schoolId}/orders/${orderId}/changes/${changeId}/reject`,
      { rejection_reason: rejectionReason }
    );
    return response.data;
  },
};

export default orderChangesService;
