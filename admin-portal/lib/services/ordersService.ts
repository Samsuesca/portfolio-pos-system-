import apiClient, {
  Order,
  OrderWithItems,
  OrderItem,
  OrderPayment,
  OrderStatus,
  OrderItemStatus,
  PaymentMethod,
  OrderType,
  YomberMeasurements,
} from '../api';

export interface OrderListParams {
  school_id?: string;
  status?: string;
  search?: string;
  skip?: number;
  limit?: number;
}

export interface CreateOrderItemData {
  order_type: OrderType;
  garment_type_id?: string;
  product_id?: string;
  global_product_id?: string;
  is_global_product?: boolean;
  quantity: number;
  unit_price?: number;
  size?: string;
  color?: string;
  gender?: 'unisex' | 'male' | 'female';
  custom_measurements?: YomberMeasurements;
  additional_price?: number;
  embroidery_text?: string;
  needs_quotation?: boolean;
  reserve_stock?: boolean;
  notes?: string;
}

export interface CreateOrderData {
  client_id?: string;
  items: CreateOrderItemData[];
  advance_payment?: number;
  advance_payment_method?: PaymentMethod;
  delivery_date?: string;
  delivery_type?: 'pickup' | 'delivery';
  delivery_zone_id?: string;
  notes?: string;
  source?: string;
}

export interface UpdateOrderData {
  delivery_date?: string;
  notes?: string;
  status?: OrderStatus;
}

export interface AddOrderPaymentData {
  amount: number;
  payment_method: PaymentMethod;
  reference?: string;
}

export interface OrderApprovalData {
  auto_fulfill?: boolean;
  items_action?: Record<string, 'fulfill' | 'produce' | 'skip'>;
}

export interface StockVerificationItem {
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

export interface StockVerification {
  order_id: string;
  order_code: string;
  order_status: string;
  items: StockVerificationItem[];
  total_items: number;
  items_in_stock: number;
  items_partial: number;
  items_to_produce: number;
  can_fulfill_completely: boolean;
  suggested_action: 'approve_all' | 'partial' | 'produce_all' | 'review';
}

export interface OrderListItem extends Order {
  items_count?: number;
  student_name?: string;
  payment_proof_url?: string;
  delivery_address?: string;
  delivery_neighborhood?: string;
  delivery_city?: string;
  delivery_references?: string;
}

const ordersService = {
  // List orders (multi-school)
  list: async (params?: OrderListParams): Promise<Order[]> => {
    const response = await apiClient.get<Order[]>('/orders', { params });
    return response.data;
  },

  // Get order by ID
  getById: async (id: string): Promise<Order> => {
    const response = await apiClient.get<Order>(`/orders/${id}`);
    return response.data;
  },

  // Get order with items
  getWithItems: async (schoolId: string, orderId: string): Promise<OrderWithItems> => {
    const response = await apiClient.get<OrderWithItems>(
      `/schools/${schoolId}/orders/${orderId}`
    );
    return response.data;
  },

  // Create order
  create: async (schoolId: string, data: CreateOrderData): Promise<Order> => {
    const response = await apiClient.post<Order>(`/schools/${schoolId}/orders`, data);
    return response.data;
  },

  // Update order
  update: async (
    schoolId: string,
    orderId: string,
    data: UpdateOrderData
  ): Promise<Order> => {
    const response = await apiClient.patch<Order>(
      `/schools/${schoolId}/orders/${orderId}`,
      data
    );
    return response.data;
  },

  // Update order status
  updateStatus: async (
    schoolId: string,
    orderId: string,
    status: OrderStatus
  ): Promise<Order> => {
    const response = await apiClient.patch<Order>(
      `/schools/${schoolId}/orders/${orderId}/status`,
      { status }
    );
    return response.data;
  },

  // Update individual item status
  updateItemStatus: async (
    schoolId: string,
    orderId: string,
    itemId: string,
    status: OrderItemStatus
  ): Promise<OrderItem> => {
    const response = await apiClient.patch<OrderItem>(
      `/schools/${schoolId}/orders/${orderId}/items/${itemId}/status`,
      { status }
    );
    return response.data;
  },

  // Add payment to order
  addPayment: async (
    schoolId: string,
    orderId: string,
    data: AddOrderPaymentData
  ): Promise<OrderPayment> => {
    const response = await apiClient.post<OrderPayment>(
      `/schools/${schoolId}/orders/${orderId}/payments`,
      data
    );
    return response.data;
  },

  // Verify stock availability
  verifyStock: async (
    schoolId: string,
    orderId: string
  ): Promise<StockVerification> => {
    const response = await apiClient.get<StockVerification>(
      `/schools/${schoolId}/orders/${orderId}/stock-verification`
    );
    return response.data;
  },

  // Approve order
  approve: async (
    schoolId: string,
    orderId: string,
    data?: OrderApprovalData
  ): Promise<Order> => {
    const response = await apiClient.post<Order>(
      `/schools/${schoolId}/orders/${orderId}/approve`,
      data || {}
    );
    return response.data;
  },

  // Cancel order
  cancel: async (schoolId: string, orderId: string): Promise<Order> => {
    const response = await apiClient.post<Order>(
      `/schools/${schoolId}/orders/${orderId}/cancel`
    );
    return response.data;
  },

  // Get receipt HTML
  getReceipt: async (schoolId: string, orderId: string): Promise<string> => {
    const response = await apiClient.get<string>(
      `/schools/${schoolId}/orders/${orderId}/receipt`,
      { responseType: 'text' as any }
    );
    return response.data;
  },

  // Approve payment proof for an order
  approvePayment: async (schoolId: string, orderId: string): Promise<Order> => {
    const response = await apiClient.post<Order>(
      `/schools/${schoolId}/orders/${orderId}/approve-payment`
    );
    return response.data;
  },

  // Reject payment proof for an order
  rejectPayment: async (
    schoolId: string,
    orderId: string,
    rejectionNotes: string
  ): Promise<Order> => {
    const response = await apiClient.post<Order>(
      `/schools/${schoolId}/orders/${orderId}/reject-payment`,
      null,
      { params: { rejection_notes: rejectionNotes } }
    );
    return response.data;
  },

  // List web orders (from all schools, filtered by source='web_portal')
  listWebOrders: async (params?: OrderListParams): Promise<OrderListItem[]> => {
    const response = await apiClient.get<OrderListItem[]>('/orders', {
      params: { ...params, source: 'web_portal' }
    });
    return response.data;
  },
};

export default ordersService;
