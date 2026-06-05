import apiClient from '../utils/apiClient';
import type {
  Client, ClientListItem, ClientCreate, ClientUpdate,
  ClientStudent, ClientStudentCreate, ClientStudentUpdate,
  PaginatedResponse,
} from '../types/api';

interface ClientListParams {
  skip?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}

export const clientService = {
  list: (params: ClientListParams) =>
    apiClient.get<PaginatedResponse<ClientListItem>>('/clients', { params }),

  search: (q: string, limit = 20) =>
    apiClient.get<ClientListItem[]>('/clients/search', { params: { q, limit } }),

  getDetail: (clientId: string) =>
    apiClient.get<Client>(`/clients/${clientId}`),

  getPurchases: (clientId: string) =>
    apiClient.get<unknown[]>(`/clients/${clientId}/purchases`),

  create: (data: ClientCreate) =>
    apiClient.post<Client>('/clients', data),

  update: (clientId: string, data: ClientUpdate) =>
    apiClient.patch<Client>(`/clients/${clientId}`, data),

  addStudent: (clientId: string, data: ClientStudentCreate) =>
    apiClient.post<ClientStudent>(`/clients/${clientId}/students`, data),

  updateStudent: (clientId: string, studentId: string, data: ClientStudentUpdate) =>
    apiClient.patch<ClientStudent>(`/clients/${clientId}/students/${studentId}`, data),

  removeStudent: (clientId: string, studentId: string) =>
    apiClient.delete(`/clients/${clientId}/students/${studentId}`),
};
