import apiClient from '../utils/apiClient';
import type { SaleChangeCreate, SaleChangeListItem, SaleChangeDetail } from '../types/api';

interface SaleChangeListParams {
  skip?: number;
  limit?: number;
  status?: string;
  change_type?: string;
}

export const saleChangeService = {
  list: (params?: SaleChangeListParams) =>
    apiClient.get<SaleChangeListItem[]>('/sale-changes', { params }),

  getDetail: (changeId: string) =>
    apiClient.get<SaleChangeDetail>(`/sale-changes/${changeId}/details`),

  create: (schoolId: string, saleId: string, data: SaleChangeCreate) =>
    apiClient.post(`/schools/${schoolId}/sales/${saleId}/changes`, data),
};
