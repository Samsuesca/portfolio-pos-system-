/**
 * Vendor Service - API calls for the normalized vendor catalog
 */
import apiClient from '../utils/api-client';
import type { PaginatedResponse } from '../types/api';
import { unwrapPaginated } from '../utils/pagination';

const BASE_URL = '/vendors';

export type VendorType = 'person' | 'business' | 'internal';

export interface VendorListItem {
  id: string;
  name: string;
  type: VendorType;
  is_active: boolean;
  is_system: boolean;
}

export interface VendorSearchResult {
  id: string;
  name: string;
  type: VendorType;
}

export interface VendorResponse {
  id: string;
  name: string;
  normalized_name: string;
  type: VendorType;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_system: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorCreate {
  name: string;
  type?: VendorType;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface VendorUpdate {
  name?: string;
  type?: VendorType;
  phone?: string;
  email?: string;
  notes?: string;
  is_active?: boolean;
}

export const vendorService = {
  async getVendors(params?: {
    search?: string;
    include_inactive?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<PaginatedResponse<VendorListItem>> {
    const response = await apiClient.get<PaginatedResponse<VendorListItem>>(BASE_URL, { params });
    return unwrapPaginated(response.data);
  },

  async searchVendors(query: string, limit = 10): Promise<VendorSearchResult[]> {
    const response = await apiClient.get<VendorSearchResult[]>(`${BASE_URL}/search`, {
      params: { q: query, limit },
    });
    return response.data;
  },

  async getVendor(id: string): Promise<VendorResponse> {
    const response = await apiClient.get<VendorResponse>(`${BASE_URL}/${id}`);
    return response.data;
  },

  async createVendor(data: VendorCreate): Promise<VendorResponse> {
    const response = await apiClient.post<VendorResponse>(BASE_URL, data);
    return response.data;
  },

  async updateVendor(id: string, data: VendorUpdate): Promise<VendorResponse> {
    const response = await apiClient.patch<VendorResponse>(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  async deactivateVendor(id: string): Promise<VendorResponse> {
    const response = await apiClient.delete<VendorResponse>(`${BASE_URL}/${id}`);
    return response.data;
  },

  async mergeVendors(sourceIds: string[], targetId: string): Promise<{ merged: number }> {
    const response = await apiClient.post<{ merged: number }>(`${BASE_URL}/merge`, {
      source_ids: sourceIds,
      target_id: targetId,
    });
    return response.data;
  },
};
