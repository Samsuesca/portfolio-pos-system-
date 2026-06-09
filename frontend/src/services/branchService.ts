/**
 * Branch Service - API calls for branches (sucursales físicas, v3.1)
 *
 * El endpoint /branches puede no existir todavía en el backend (la API de
 * sucursales llega en una fase posterior). Los consumidores deben tolerar el
 * fallo: el store degrada a `availableBranches = []` (selector oculto).
 */
import apiClient from '../utils/api-client';
import type { PaginatedResponse } from '../types/api';
import { unwrapPaginated } from '../utils/pagination';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  is_headquarters: boolean;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export const branchService = {
  /**
   * Get all active branches.
   *
   * Tolera tanto la forma paginada como un array plano (igual que schoolService).
   */
  async getBranches(activeOnly = true): Promise<Branch[]> {
    const response = await apiClient.get<PaginatedResponse<Branch> | Branch[]>('/branches', {
      params: { active_only: activeOnly },
    });
    return unwrapPaginated(response.data).items;
  },

  /**
   * Get a specific branch by ID.
   */
  async getBranch(branchId: string): Promise<Branch> {
    const response = await apiClient.get<Branch>(`/branches/${branchId}`);
    return response.data;
  },
};
