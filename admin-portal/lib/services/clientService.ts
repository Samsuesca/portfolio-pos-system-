import apiClient from '@/lib/api';
import type { Client } from '@/lib/api';

export interface ClientCreate {
  name: string;
  phone?: string;
  email?: string;
  student_name?: string;
  student_grade?: string;
  address?: string;
  notes?: string;
}

export interface ClientUpdate extends Partial<ClientCreate> {
  is_active?: boolean;
}

export interface ClientListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const clientService = {
  // Clients are GLOBAL (not tied to schools) in this system
  async getClients(params?: ClientListParams): Promise<Client[]> {
    const response = await apiClient.get('/clients', {
      params: {
        limit: params?.limit || 500,
        skip: params?.offset || 0,
        search: params?.search,
        is_active: true,
      },
    });
    return response.data;
  },

  async searchClients(query: string, limit: number = 20): Promise<Client[]> {
    const response = await apiClient.get('/clients/search', {
      params: { q: query, limit },
    });
    return response.data;
  },

  async getClientById(clientId: string): Promise<Client> {
    const response = await apiClient.get(`/clients/${clientId}`);
    return response.data;
  },

  async createClient(data: ClientCreate): Promise<Client> {
    const response = await apiClient.post('/clients', data);
    return response.data;
  },

  async updateClient(clientId: string, data: ClientUpdate): Promise<Client> {
    const response = await apiClient.put(`/clients/${clientId}`, data);
    return response.data;
  },

  async deleteClient(clientId: string): Promise<void> {
    await apiClient.delete(`/clients/${clientId}`);
  },
};

export default clientService;
