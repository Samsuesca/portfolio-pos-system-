/**
 * Order Service - API calls for orders (encargos)
 *
 * Two types of endpoints:
 * - Multi-school: /orders - Lists from ALL schools user has access to
 * - School-specific: /schools/{school_id}/orders - Original endpoints
 */
import apiClient from '../utils/api-client';
import type { Order, OrderListItem, OrderWithItems, OrderCreate, OrderPayment, OrderStatus, OrderItemStatus, OrderItem, ProductDemandResponse, ProductDemandFilters } from '../types/api';

export interface OrderFilters {
  school_id?: string;
  status?: OrderStatus;
  search?: string;
  skip?: number;
  limit?: number;
  source_filter?: string;  // 'exclude_web_portal' to exclude web portal orders
  start_date?: string;  // YYYY-MM-DD
  end_date?: string;    // YYYY-MM-DD
}

export const orderService = {
  /**
   * Get all orders from ALL schools user has access to (multi-school)
   */
  async getAllOrders(filters?: OrderFilters): Promise<OrderListItem[]> {
    const params = new URLSearchParams();
    if (filters?.school_id) params.append('school_id', filters.school_id);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.skip) params.append('skip', String(filters.skip));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.source_filter) params.append('source_filter', filters.source_filter);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);

    const queryString = params.toString();
    const url = queryString ? `/orders?${queryString}` : '/orders';
    const response = await apiClient.get<OrderListItem[]>(url);
    return response.data;
  },

  /**
   * Get all orders for a school (backwards compatible)
   * Uses multi-school endpoint with school filter
   */
  async getOrders(schoolId?: string, status?: OrderStatus): Promise<OrderListItem[]> {
    const filters: OrderFilters = {};
    if (schoolId) filters.school_id = schoolId;
    if (status) filters.status = status;
    return this.getAllOrders(filters);
  },

  /**
   * Get a single order by ID (from any accessible school)
   */
  async getOrderById(orderId: string): Promise<Order> {
    const response = await apiClient.get<Order>(`/orders/${orderId}`);
    return response.data;
  },

  /**
   * Get a single order with items (school-specific) - DEPRECATED: Use getOrderDetails instead
   */
  async getOrder(schoolId: string, orderId: string): Promise<OrderWithItems> {
    const response = await apiClient.get<OrderWithItems>(`/schools/${schoolId}/orders/${orderId}`);
    return response.data;
  },

  /**
   * Get an order with full details (does not require school_id)
   * Validates access based on user's accessible schools
   */
  async getOrderDetails(orderId: string): Promise<OrderWithItems> {
    const response = await apiClient.get<OrderWithItems>(`/orders/${orderId}/details`);
    return response.data;
  },

  /**
   * Create a new order (school-specific)
   */
  async createOrder(schoolId: string, data: OrderCreate): Promise<Order> {
    const response = await apiClient.post<Order>(`/schools/${schoolId}/orders`, data);
    return response.data;
  },

  /**
   * Update order status (school-specific)
   */
  async updateStatus(schoolId: string, orderId: string, status: OrderStatus): Promise<Order> {
    const response = await apiClient.patch<Order>(
      `/schools/${schoolId}/orders/${orderId}/status`,
      null,
      { params: { new_status: status } }
    );
    return response.data;
  },

  /**
   * Add payment to order (school-specific)
   */
  async addPayment(schoolId: string, orderId: string, payment: OrderPayment): Promise<Order> {
    const response = await apiClient.post<Order>(
      `/schools/${schoolId}/orders/${orderId}/payments`,
      payment
    );
    return response.data;
  },

  /**
   * Update order details (delivery_date, notes) - school-specific
   */
  async updateOrder(schoolId: string, orderId: string, data: { delivery_date?: string; notes?: string }): Promise<Order> {
    const response = await apiClient.patch<Order>(
      `/schools/${schoolId}/orders/${orderId}`,
      data
    );
    return response.data;
  },

  /**
   * Update individual order item status (school-specific)
   *
   * Allows tracking progress of individual items within an order.
   * For example: a catalog item may be ready while a yomber is still in production.
   */
  async updateItemStatus(
    schoolId: string,
    orderId: string,
    itemId: string,
    status: OrderItemStatus
  ): Promise<OrderItem> {
    const response = await apiClient.patch<OrderItem>(
      `/schools/${schoolId}/orders/${orderId}/items/${itemId}/status`,
      { item_status: status }
    );
    return response.data;
  },

  /**
   * Verify stock availability for all items in an order
   *
   * Returns detailed information about which items can be fulfilled from
   * current inventory vs which need to be produced.
   */
  async verifyOrderStock(schoolId: string, orderId: string): Promise<OrderStockVerification> {
    const response = await apiClient.get<OrderStockVerification>(
      `/schools/${schoolId}/orders/${orderId}/stock-verification`
    );
    return response.data;
  },

  /**
   * Approve/process a web order with intelligent stock handling
   *
   * This endpoint:
   * 1. Checks stock availability for each item
   * 2. For items WITH stock: marks as READY and decrements inventory
   * 3. For items WITHOUT stock: marks as IN_PRODUCTION
   */
  async approveOrderWithStock(
    schoolId: string,
    orderId: string,
    options?: {
      auto_fulfill_if_stock?: boolean;
      items?: Array<{
        item_id: string;
        action: 'fulfill' | 'produce' | 'auto';
        product_id?: string;
        quantity_from_stock?: number;
      }>;
    }
  ): Promise<Order> {
    const response = await apiClient.post<Order>(
      `/schools/${schoolId}/orders/${orderId}/approve`,
      {
        auto_fulfill_if_stock: options?.auto_fulfill_if_stock ?? true,
        items: options?.items || [],
        notify_client: true
      }
    );
    return response.data;
  },

  /**
   * Approve payment proof for an order
   */
  async approvePayment(schoolId: string, orderId: string): Promise<any> {
    const response = await apiClient.post(`/schools/${schoolId}/orders/${orderId}/approve-payment`);
    return response.data;
  },

  /**
   * Reject payment proof for an order
   */
  async rejectPayment(schoolId: string, orderId: string, rejectionNotes: string): Promise<any> {
    const response = await apiClient.post(
      `/schools/${schoolId}/orders/${orderId}/reject-payment`,
      null,
      { params: { rejection_notes: rejectionNotes } }
    );
    return response.data;
  },

  /**
   * Get receipt URL for printing
   */
  getReceiptUrl(schoolId: string, orderId: string): string {
    const apiUrl = localStorage.getItem('api_url') || 'http://localhost:8000';
    return `${apiUrl}/api/v1/schools/${schoolId}/orders/${orderId}/receipt`;
  },

  /**
   * Send receipt email to client
   */
  async sendReceiptEmail(schoolId: string, orderId: string): Promise<{ message: string; success: boolean }> {
    const response = await apiClient.post<{ message: string; success: boolean }>(
      `/schools/${schoolId}/orders/${orderId}/send-receipt`
    );
    return response.data;
  },

  /**
   * Cancel an order and release any reserved stock ("pisar" functionality)
   *
   * This endpoint:
   * 1. Validates the order can be cancelled (not delivered/already cancelled)
   * 2. Releases any stock that was reserved for this order
   * 3. Marks all items and the order as CANCELLED
   *
   * @param schoolId - School ID
   * @param orderId - Order ID to cancel
   * @param reason - Optional cancellation reason (added to order notes)
   * @returns Updated order with CANCELLED status
   */
  async cancelOrder(schoolId: string, orderId: string, reason?: string): Promise<Order> {
    const params = reason ? { reason } : {};
    const response = await apiClient.post<Order>(
      `/schools/${schoolId}/orders/${orderId}/cancel`,
      null,
      { params }
    );
    return response.data;
  },

  /**
   * Get aggregated product demand from pending/in_production orders.
   *
   * Single optimized query replaces N+1 pattern.
   * Returns products grouped by (garment_type, size, color, is_yomber) with:
   * - Quantity breakdown by item status (pending, in_production, ready)
   * - References to all orders containing this product
   * - School information for multi-school users
   */
  async getProductDemand(filters?: ProductDemandFilters): Promise<ProductDemandResponse> {
    const params = new URLSearchParams();
    if (filters?.school_id) params.append('school_id', filters.school_id);
    if (filters?.include_ready) params.append('include_ready', 'true');
    if (filters?.type_filter) params.append('type_filter', filters.type_filter);
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);

    const queryString = params.toString();
    const url = queryString ? `/orders/demand?${queryString}` : '/orders/demand';
    const response = await apiClient.get<ProductDemandResponse>(url);
    return response.data;
  },
};

// Types for stock verification
export interface OrderItemStockInfo {
  item_id: string;
  garment_type_id: string;
  garment_type_name: string;
  size: string | null;
  color: string | null;
  quantity_requested: number;
  product_id: string | null;
  product_code: string | null;
  stock_available: number;
  can_fulfill_from_stock: boolean;
  quantity_from_stock: number;
  quantity_to_produce: number;
  suggested_action: 'fulfill' | 'partial' | 'produce';
  has_custom_measurements: boolean;
  item_status: string;
}

export interface OrderStockVerification {
  order_id: string;
  order_code: string;
  order_status: string;
  items: OrderItemStockInfo[];
  total_items: number;
  items_in_stock: number;
  items_partial: number;
  items_to_produce: number;
  can_fulfill_completely: boolean;
  suggested_action: 'approve_all' | 'partial' | 'produce_all' | 'review';
}
