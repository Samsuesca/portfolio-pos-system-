import apiClient from '../utils/apiClient';
import type { OrderListItem, OrderDetail, OrderPaymentCreate, OrderCreate, PaginatedResponse } from '../types/api';

interface OrderListParams {
  skip?: number;
  limit?: number;
  school_id?: string;
  status?: string;
  search?: string;
}

export const orderService = {
  list: (params: OrderListParams) =>
    apiClient.get<PaginatedResponse<OrderListItem>>('/orders', { params }),

  getDetail: (orderId: string) =>
    apiClient.get<OrderDetail>(`/orders/${orderId}/details`),

  updateStatus: (schoolId: string, orderId: string, newStatus: string) =>
    apiClient.patch(`/schools/${schoolId}/orders/${orderId}/status`, null, {
      params: { new_status: newStatus },
    }),

  addPayment: (schoolId: string, orderId: string, data: OrderPaymentCreate) =>
    apiClient.post(`/schools/${schoolId}/orders/${orderId}/payments`, data),

  create: (schoolId: string, data: OrderCreate) =>
    apiClient.post(`/schools/${schoolId}/orders`, data),
};
