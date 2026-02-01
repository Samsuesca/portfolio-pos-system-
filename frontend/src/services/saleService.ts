/**
 * Sale Service - API calls for sales
 *
 * Two types of endpoints:
 * - Multi-school: /sales - Lists from ALL schools user has access to
 * - School-specific: /schools/{school_id}/sales - Original endpoints
 */
import apiClient from '../utils/api-client';
import type { Sale, SaleWithItems, SaleListItem, SalePayment } from '../types/api';

export interface SaleItemCreate {
  product_id: string;
  quantity: number;
  unit_price: number;
  is_global?: boolean;  // True if product is from global inventory
}

export type PaymentMethod = 'cash' | 'nequi' | 'credit' | 'transfer' | 'card';

export interface SalePaymentCreate {
  amount: number;
  payment_method: PaymentMethod;
  notes?: string;
  // Cash change tracking (only for cash payments)
  amount_received?: number;
}

export interface SaleCreate {
  school_id: string;
  client_id?: string | null;
  items: SaleItemCreate[];
  // Single payment method (deprecated, use payments instead)
  payment_method?: PaymentMethod;
  // Multiple payments support
  payments?: SalePaymentCreate[];
  notes?: string;
  source?: 'desktop_app' | 'web_portal' | 'api';
  // Historical sales (migration) - don't affect inventory
  is_historical?: boolean;
  sale_date?: string;  // ISO date string for historical sales
}

export interface SaleFilters {
  school_id?: string;
  status?: string;
  source?: 'desktop_app' | 'web_portal' | 'api';
  search?: string;
  skip?: number;
  limit?: number;
  include_historical?: boolean;
  start_date?: string;  // YYYY-MM-DD
  end_date?: string;    // YYYY-MM-DD
}

export interface SaleCancelRequest {
  reason: string;
  refund_method?: PaymentMethod;
}

export interface SaleUpdate {
  client_id?: string | null;
  notes?: string;
}

export interface SaleCancelResponse {
  id: string;
  code: string;
  status: string;
  cancelled_at: string;
  inventory_restored: boolean;
  transactions_reversed: boolean;
  receivables_cancelled: boolean;
  message: string;
}

export const saleService = {
  /**
   * Get all sales from ALL schools user has access to (multi-school)
   */
  async getAllSales(filters?: SaleFilters): Promise<SaleListItem[]> {
    const params = new URLSearchParams();
    if (filters?.school_id) params.append('school_id', filters.school_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.source) params.append('source', filters.source);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.skip) params.append('skip', String(filters.skip));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.include_historical !== undefined) {
      params.append('include_historical', String(filters.include_historical));
    }
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const queryString = params.toString();
    const url = queryString ? `/sales?${queryString}` : '/sales';
    const response = await apiClient.get<SaleListItem[]>(url);
    return response.data;
  },

  /**
   * Get all sales for a specific school (backwards compatible)
   * Uses multi-school endpoint with school filter
   */
  async getSales(schoolId?: string): Promise<SaleListItem[]> {
    if (schoolId) {
      return this.getAllSales({ school_id: schoolId });
    }
    return this.getAllSales();
  },

  /**
   * Get a single sale by ID (from any accessible school)
   */
  async getSaleById(saleId: string): Promise<Sale> {
    const response = await apiClient.get<Sale>(`/sales/${saleId}`);
    return response.data;
  },

  /**
   * Get a single sale by ID (school-specific)
   */
  async getSale(schoolId: string, saleId: string): Promise<Sale> {
    const response = await apiClient.get<Sale>(`/schools/${schoolId}/sales/${saleId}`);
    return response.data;
  },

  /**
   * Get a sale with its items (school-specific) - DEPRECATED: Use getSaleDetails instead
   */
  async getSaleWithItems(schoolId: string, saleId: string): Promise<SaleWithItems> {
    const response = await apiClient.get<SaleWithItems>(`/schools/${schoolId}/sales/${saleId}/items`);
    return response.data;
  },

  /**
   * Get a sale with full details (does not require school_id)
   * Validates access based on user's accessible schools
   */
  async getSaleDetails(saleId: string): Promise<SaleWithItems> {
    const response = await apiClient.get<SaleWithItems>(`/sales/${saleId}/details`);
    return response.data;
  },

  /**
   * Create a new sale (school-specific)
   */
  async createSale(schoolId: string, data: SaleCreate): Promise<Sale> {
    const response = await apiClient.post<Sale>(`/schools/${schoolId}/sales`, data);
    return response.data;
  },

  /**
   * Update a sale's editable fields (school-specific)
   * Used to assign/change client or update notes
   */
  async updateSale(schoolId: string, saleId: string, data: SaleUpdate): Promise<Sale> {
    const response = await apiClient.patch<Sale>(`/schools/${schoolId}/sales/${saleId}`, data);
    return response.data;
  },

  /**
   * Add payment to existing sale (admin only)
   * Used to add payments to sales that were created without payment info
   * or to add additional partial payments
   */
  async addPaymentToSale(
    schoolId: string,
    saleId: string,
    paymentData: {
      amount: number;
      payment_method: PaymentMethod;
      notes?: string;
      apply_accounting?: boolean;
    }
  ): Promise<SalePayment> {
    const response = await apiClient.post<SalePayment>(
      `/schools/${schoolId}/sales/${saleId}/payments`,
      paymentData
    );
    return response.data;
  },

  /**
   * Send sale receipt by email to client
   * Requires the client to have a valid email address
   */
  async sendReceiptEmail(
    schoolId: string,
    saleId: string
  ): Promise<{ message: string; success: boolean }> {
    const response = await apiClient.post<{ message: string; success: boolean }>(
      `/schools/${schoolId}/sales/${saleId}/send-receipt`
    );
    return response.data;
  },

  /**
   * Cancel a sale with full rollback (admin only)
   * Restores inventory, reverses transactions, and cancels receivables
   */
  async cancelSale(
    schoolId: string,
    saleId: string,
    data: SaleCancelRequest
  ): Promise<SaleCancelResponse> {
    const response = await apiClient.post<SaleCancelResponse>(
      `/schools/${schoolId}/sales/${saleId}/cancel`,
      data
    );
    return response.data;
  },
};
