/**
 * Sale Change Service - API calls for sale changes/returns
 */
import apiClient from '../utils/api-client';
import type { SaleChange, SaleChangeCreate, SaleChangeListItem, SaleChangeDetailResponse } from '../types/api';

export interface SaleChangeFilters {
  status?: 'pending' | 'pending_stock' | 'approved' | 'rejected';
  change_type?: 'size_change' | 'product_change' | 'return' | 'defect';
  limit?: number;
}

export const saleChangeService = {
  /**
   * Get all changes from all schools (global endpoint)
   * Much more efficient than loading changes per sale
   */
  async getAllChanges(filters?: SaleChangeFilters): Promise<SaleChangeListItem[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.change_type) params.append('change_type', filters.change_type);
    if (filters?.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/sale-changes?${queryString}` : '/sale-changes';
    const response = await apiClient.get<SaleChangeListItem[]>(url);
    return response.data;
  },

  /**
   * Create a new sale change request
   */
  async createChange(
    schoolId: string,
    saleId: string,
    data: SaleChangeCreate
  ): Promise<SaleChange> {
    const response = await apiClient.post<SaleChange>(
      `/schools/${schoolId}/sales/${saleId}/changes`,
      data
    );
    return response.data;
  },

  /**
   * Get all changes for a specific sale
   */
  async getSaleChanges(schoolId: string, saleId: string): Promise<SaleChangeListItem[]> {
    const response = await apiClient.get<SaleChangeListItem[]>(
      `/schools/${schoolId}/sales/${saleId}/changes`
    );
    return response.data;
  },

  /**
   * Approve a sale change request (ADMIN only)
   * @param paymentMethod - Payment method for refunds/additional payments (cash, nequi, transfer, card)
   */
  async approveChange(
    schoolId: string,
    saleId: string,
    changeId: string,
    paymentMethod?: 'cash' | 'nequi' | 'transfer' | 'card'
  ): Promise<SaleChange> {
    const data = paymentMethod ? { payment_method: paymentMethod } : undefined;
    const response = await apiClient.patch<SaleChange>(
      `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/approve`,
      data
    );
    return response.data;
  },

  /**
   * Reject a sale change request (ADMIN only)
   */
  async rejectChange(
    schoolId: string,
    saleId: string,
    changeId: string,
    rejectionReason: string
  ): Promise<SaleChange> {
    const response = await apiClient.patch<SaleChange>(
      `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/reject`,
      { rejection_reason: rejectionReason }
    );
    return response.data;
  },

  /**
   * Complete a change that was waiting for stock (PENDING_STOCK status)
   * This is called when the associated order has been fulfilled
   */
  async completeFromOrder(
    schoolId: string,
    saleId: string,
    changeId: string
  ): Promise<SaleChange> {
    const response = await apiClient.patch<SaleChange>(
      `/schools/${schoolId}/sales/${saleId}/changes/${changeId}/complete-from-order`
    );
    return response.data;
  },

  /**
   * Get detailed information for a sale change
   * Includes transactions, inventory movements, and full product details
   */
  async getChangeDetails(changeId: string): Promise<SaleChangeDetailResponse> {
    const response = await apiClient.get<SaleChangeDetailResponse>(
      `/sale-changes/${changeId}/details`
    );
    return response.data;
  },
};
