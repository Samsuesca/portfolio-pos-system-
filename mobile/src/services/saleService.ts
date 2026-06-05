import apiClient from '../utils/apiClient';
import type { SaleListItem, SaleDetail, SaleCreate, SalePayment, AddPaymentToSale, PaginatedResponse } from '../types/api';

interface SaleListParams {
  skip?: number;
  limit?: number;
  school_id?: string;
  status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
}

export const saleService = {
  list: (params: SaleListParams) =>
    apiClient.get<PaginatedResponse<SaleListItem>>('/sales', { params }),

  getDetail: (saleId: string) =>
    apiClient.get<SaleDetail>(`/sales/${saleId}`),

  create: (schoolId: string, data: SaleCreate) =>
    apiClient.post<SaleDetail>(`/schools/${schoolId}/sales`, data),

  addPayment: (schoolId: string, saleId: string, data: AddPaymentToSale) =>
    apiClient.post<SalePayment>(`/schools/${schoolId}/sales/${saleId}/payments`, data),
};
