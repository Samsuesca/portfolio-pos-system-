import apiClient from '../utils/apiClient';
import type { ProductListItem, GarmentType, PaginatedResponse } from '../types/api';
import { unwrapPaginated } from '../utils/pagination';

interface ProductListParams {
  skip?: number;
  limit?: number;
  school_id?: string;
  garment_type_id?: string;
  search?: string;
  active_only?: boolean;
  with_stock?: boolean;
}

export const productService = {
  list: async (params: ProductListParams) => {
    const response = await apiClient.get<ProductListItem[] | PaginatedResponse<ProductListItem>>('/products', { params });
    return { ...response, data: unwrapPaginated(response.data).items };
  },

  listGarmentTypes: async (params?: { school_id?: string; active_only?: boolean }) => {
    const response = await apiClient.get<GarmentType[] | PaginatedResponse<GarmentType>>('/products/garment-types', { params });
    return { ...response, data: unwrapPaginated(response.data).items };
  },
};
