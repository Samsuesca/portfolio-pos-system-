import apiClient, { User, UserSchoolRole, PaginatedResponse } from '../api';
import { unwrapPaginated } from '../utils/pagination';

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  is_superuser?: boolean;
}

export interface UpdateUserData {
  email?: string;
  full_name?: string;
  is_active?: boolean;
  is_superuser?: boolean;
}

export type UserRole = 'owner' | 'admin' | 'seller' | 'viewer';

const userService = {
  // List all users
  list: async (params?: { skip?: number; limit?: number; include_inactive?: boolean }): Promise<User[]> => {
    const response = await apiClient.get<User[] | PaginatedResponse<User>>('/users', { params });
    return unwrapPaginated(response.data).items;
  },

  // Get user by ID
  getById: async (id: string) => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  // Create new user
  create: async (data: CreateUserData) => {
    const response = await apiClient.post<User>('/users', data);
    return response.data;
  },

  // Update user
  update: async (id: string, data: UpdateUserData) => {
    const response = await apiClient.put<User>(`/users/${id}`, data);
    return response.data;
  },

  // Delete user
  delete: async (id: string) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  // Get user's school roles
  getSchoolRoles: async (userId: string): Promise<UserSchoolRole[]> => {
    const response = await apiClient.get<UserSchoolRole[] | PaginatedResponse<UserSchoolRole>>(`/users/${userId}/schools`);
    return unwrapPaginated(response.data).items;
  },

  // Add user role for school (role as query param)
  addSchoolRole: async (userId: string, schoolId: string, role: 'owner' | 'admin' | 'seller' | 'viewer') => {
    const response = await apiClient.post(`/users/${userId}/schools/${schoolId}/role`, null, {
      params: { role }
    });
    return response.data;
  },

  // Update user role for school (role as query param)
  updateSchoolRole: async (userId: string, schoolId: string, role: 'owner' | 'admin' | 'seller' | 'viewer') => {
    const response = await apiClient.put(`/users/${userId}/schools/${schoolId}/role`, null, {
      params: { role }
    });
    return response.data;
  },

  // Remove user role for school
  removeSchoolRole: async (userId: string, schoolId: string) => {
    const response = await apiClient.delete(`/users/${userId}/schools/${schoolId}/role`);
    return response.data;
  },

  // Get all users for a specific school
  getSchoolUsers: async (schoolId: string): Promise<User[]> => {
    const response = await apiClient.get<User[] | PaginatedResponse<User>>(`/users/schools/${schoolId}/users`);
    return unwrapPaginated(response.data).items;
  },
};

export default userService;
