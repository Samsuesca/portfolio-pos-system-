import apiClient, { School, PaginatedResponse } from '../api';

export interface SchoolSettings {
  currency: string;
  tax_rate: number;
  commission_per_garment: number;
  allow_credit_sales: boolean;
  max_credit_days: number;
}

export interface CreateSchoolData {
  code: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  primary_color?: string;
  secondary_color?: string;
  settings?: Partial<SchoolSettings>;
}

export interface UpdateSchoolData {
  code?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  primary_color?: string;
  secondary_color?: string;
  is_active?: boolean;
  display_order?: number;
  settings?: Partial<SchoolSettings>;
}

const schoolService = {
  // List all schools
  list: async (params?: { skip?: number; limit?: number; include_inactive?: boolean }) => {
    const response = await apiClient.get<School[]>('/schools', { params });
    return response.data;
  },

  // Get school by ID
  getById: async (id: string) => {
    const response = await apiClient.get<School>(`/schools/${id}`);
    return response.data;
  },

  // Get school with summary/stats
  getSummary: async (id: string) => {
    const response = await apiClient.get(`/schools/${id}/summary`);
    return response.data;
  },

  // Create new school
  create: async (data: CreateSchoolData) => {
    const response = await apiClient.post<School>('/schools', data);
    return response.data;
  },

  // Update school
  update: async (id: string, data: UpdateSchoolData) => {
    const response = await apiClient.put<School>(`/schools/${id}`, data);
    return response.data;
  },

  // Deactivate school (soft delete)
  deactivate: async (id: string) => {
    const response = await apiClient.delete(`/schools/${id}`);
    return response.data;
  },

  // Activate school
  activate: async (id: string) => {
    const response = await apiClient.post(`/schools/${id}/activate`);
    return response.data;
  },

  // Reorder schools
  reorder: async (schoolIds: string[]) => {
    const response = await apiClient.put('/schools/reorder', { school_ids: schoolIds });
    return response.data;
  },

  // Upload school logo
  uploadLogo: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<School>(`/schools/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Delete school logo
  deleteLogo: async (id: string) => {
    await apiClient.delete(`/schools/${id}/logo`);
  },
};

export default schoolService;
