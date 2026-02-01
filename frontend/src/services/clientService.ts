/**
 * Client Service - API calls for clients
 *
 * Clients are GLOBAL (not tied to a specific school).
 * Endpoints: /api/v1/clients
 */
import apiClient from '../utils/api-client';
import type { Client } from '../types/api';

export interface ClientFilters {
  search?: string;
  client_type?: 'regular' | 'web';
  is_active?: boolean;
  skip?: number;
  limit?: number;
}

export const clientService = {
  /**
   * Get all clients (global)
   * @deprecated schoolId parameter is no longer used - clients are global
   */
  async getClients(_schoolId?: string, filters?: ClientFilters): Promise<Client[]> {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.client_type) params.append('client_type', filters.client_type);
    if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
    if (filters?.skip) params.append('skip', String(filters.skip));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/clients?${queryString}` : '/clients';
    const response = await apiClient.get<Client[]>(url);
    return response.data;
  },

  /**
   * Search clients by term
   */
  async searchClients(query: string, limit: number = 20): Promise<Client[]> {
    const response = await apiClient.get<Client[]>(`/clients/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data;
  },

  /**
   * Get a single client by ID
   * @deprecated schoolId parameter is no longer used - clients are global
   */
  async getClient(schoolIdOrClientId: string, clientId?: string): Promise<Client> {
    // Support both old signature (schoolId, clientId) and new (clientId)
    const id = clientId || schoolIdOrClientId;
    const response = await apiClient.get<Client>(`/clients/${id}`);
    return response.data;
  },

  /**
   * Get client summary with purchase stats
   */
  async getClientSummary(clientId: string): Promise<any> {
    const response = await apiClient.get(`/clients/${clientId}/summary`);
    return response.data;
  },

  /**
   * Create a new client (global)
   * @deprecated schoolId parameter is no longer used - clients are global
   */
  async createClient(schoolIdOrData: string | Partial<Client>, data?: Partial<Client>): Promise<Client> {
    // Support both old signature (schoolId, data) and new (data)
    const clientData = data || (typeof schoolIdOrData === 'object' ? schoolIdOrData : {});
    const response = await apiClient.post<Client>('/clients', clientData);
    return response.data;
  },

  /**
   * Update a client
   * @deprecated schoolId parameter is no longer used - clients are global
   */
  async updateClient(schoolIdOrClientId: string, clientIdOrData: string | Partial<Client>, data?: Partial<Client>): Promise<Client> {
    // Support both old signature (schoolId, clientId, data) and new (clientId, data)
    let clientId: string;
    let updateData: Partial<Client>;

    if (data) {
      // Old signature: (schoolId, clientId, data)
      clientId = clientIdOrData as string;
      updateData = data;
    } else {
      // New signature: (clientId, data)
      clientId = schoolIdOrClientId;
      updateData = clientIdOrData as Partial<Client>;
    }

    const response = await apiClient.patch<Client>(`/clients/${clientId}`, updateData);
    return response.data;
  },

  /**
   * Delete a client (soft delete) - requires admin
   * @deprecated schoolId parameter is no longer used - clients are global
   */
  async deleteClient(schoolIdOrClientId: string, clientId?: string): Promise<void> {
    // Support both old signature (schoolId, clientId) and new (clientId)
    const id = clientId || schoolIdOrClientId;
    await apiClient.delete(`/clients/${id}`);
  },

  /**
   * Get top clients by total spent
   */
  async getTopClients(limit: number = 10): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/clients/top?limit=${limit}`);
    return response.data;
  },

  /**
   * Resend activation email to a client
   */
  async resendActivationEmail(clientId: string): Promise<{ message: string; email: string }> {
    const response = await apiClient.post<{ message: string; email: string }>(`/clients/${clientId}/resend-activation`);
    return response.data;
  },

  // ======================
  // Student Management
  // ======================

  /**
   * Add a student to a client
   */
  async addStudent(clientId: string, studentData: {
    school_id: string;
    student_name: string;
    student_grade?: string;
    student_section?: string;
    notes?: string;
  }): Promise<any> {
    const response = await apiClient.post(`/clients/${clientId}/students`, studentData);
    return response.data;
  },

  /**
   * Update a client's student
   */
  async updateStudent(clientId: string, studentId: string, studentData: {
    student_name?: string;
    student_grade?: string;
    student_section?: string;
    notes?: string;
    is_active?: boolean;
  }): Promise<any> {
    const response = await apiClient.patch(`/clients/${clientId}/students/${studentId}`, studentData);
    return response.data;
  },

  /**
   * Remove a student from a client
   */
  async removeStudent(clientId: string, studentId: string): Promise<void> {
    await apiClient.delete(`/clients/${clientId}/students/${studentId}`);
  },
};
