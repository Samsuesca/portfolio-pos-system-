/**
 * School Service - API calls for schools
 */
import apiClient from '../utils/api-client';

export interface SchoolSettings {
  currency: string;
  tax_rate: number;
  commission_per_garment: number;
  allow_credit_sales: boolean;
  max_credit_days: number;
}

export interface School {
  id: string;
  code: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  settings: SchoolSettings | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface SchoolCreate {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  settings?: Partial<SchoolSettings>;
}

export interface SchoolUpdate {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  is_active?: boolean;
  settings?: Partial<SchoolSettings>;
}

export interface SchoolSummary extends School {
  products_count: number;
  sales_count: number;
  orders_count: number;
  clients_count: number;
}

export const schoolService = {
  /**
   * Get all active schools
   */
  async getSchools(activeOnly = true): Promise<School[]> {
    const response = await apiClient.get<School[]>('/schools', {
      params: { active_only: activeOnly }
    });
    return response.data;
  },

  /**
   * Get a specific school by ID
   */
  async getSchool(schoolId: string): Promise<School> {
    const response = await apiClient.get<School>(`/schools/${schoolId}`);
    return response.data;
  },

  /**
   * Get school summary with statistics
   */
  async getSchoolSummary(schoolId: string): Promise<SchoolSummary> {
    const response = await apiClient.get<SchoolSummary>(`/schools/${schoolId}/summary`);
    return response.data;
  },

  /**
   * Search schools by name
   */
  async searchSchools(name: string, limit = 10): Promise<School[]> {
    const response = await apiClient.get<School[]>('/schools/search/by-name', {
      params: { name, limit }
    });
    return response.data;
  },

  // ==========================================
  // CRUD Operations (Superuser only)
  // ==========================================

  /**
   * Create new school (superuser only)
   */
  async createSchool(data: SchoolCreate): Promise<School> {
    const response = await apiClient.post<School>('/schools', data);
    return response.data;
  },

  /**
   * Update school (superuser only)
   */
  async updateSchool(schoolId: string, data: SchoolUpdate): Promise<School> {
    const response = await apiClient.put<School>(`/schools/${schoolId}`, data);
    return response.data;
  },

  /**
   * Deactivate school (soft delete, superuser only)
   */
  async deleteSchool(schoolId: string): Promise<void> {
    await apiClient.delete(`/schools/${schoolId}`);
  },

  /**
   * Activate school (superuser only)
   */
  async activateSchool(schoolId: string): Promise<School> {
    const response = await apiClient.post<School>(`/schools/${schoolId}/activate`);
    return response.data;
  },

  /**
   * Upload school logo (superuser only)
   */
  async uploadLogo(schoolId: string, file: File): Promise<School> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<School>(`/schools/${schoolId}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * Delete school logo (superuser only)
   */
  async deleteLogo(schoolId: string): Promise<void> {
    await apiClient.delete(`/schools/${schoolId}/logo`);
  },
};
