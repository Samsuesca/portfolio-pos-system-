/**
 * User Service - API calls for user management
 */
import apiClient from '../utils/api-client';
import type { UserRole } from '../types/api';

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UserSchoolRole {
  id: string;
  user_id: string;
  school_id: string;
  role: UserRole | null;  // Can be null if using custom_role_id
  custom_role_id?: string | null;
  is_primary: boolean;
  created_at: string;
  school: {
    id: string;
    code: string;
    name: string;
    is_active: boolean;
  };
}

export interface UserWithRoles extends User {
  school_roles: UserSchoolRole[];
}

export interface UserCreate {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  is_superuser?: boolean;
}

export interface UserUpdate {
  email?: string;
  full_name?: string;
  is_active?: boolean;
}

export interface PasswordChange {
  old_password: string;
  new_password: string;
}

export const userService = {
  // ==========================================
  // Current User Profile
  // ==========================================

  /**
   * Get current user info
   */
  async getMe(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  },

  /**
   * Update current user profile
   */
  async updateProfile(userId: string, data: UserUpdate): Promise<User> {
    const response = await apiClient.put<User>(`/users/${userId}`, data);
    return response.data;
  },

  /**
   * Change current user password
   */
  async changePassword(data: PasswordChange): Promise<void> {
    await apiClient.post('/auth/change-password', data);
  },

  // ==========================================
  // User Management (Superuser only)
  // ==========================================

  /**
   * Get all users
   */
  async getUsers(skip = 0, limit = 100): Promise<User[]> {
    const response = await apiClient.get<User[]>('/users', {
      params: { skip, limit }
    });
    return response.data;
  },

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User> {
    const response = await apiClient.get<User>(`/users/${userId}`);
    return response.data;
  },

  /**
   * Create new user
   */
  async createUser(data: UserCreate): Promise<User> {
    const response = await apiClient.post<User>('/users', data);
    return response.data;
  },

  /**
   * Update user
   */
  async updateUser(userId: string, data: UserUpdate): Promise<User> {
    const response = await apiClient.put<User>(`/users/${userId}`, data);
    return response.data;
  },

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<{ action: string; message: string }> {
    const response = await apiClient.delete<{ action: string; message: string }>(`/users/${userId}`);
    return response.data;
  },

  // ==========================================
  // User School Roles
  // ==========================================

  /**
   * Get user's school roles
   */
  async getUserSchools(userId: string): Promise<UserSchoolRole[]> {
    const response = await apiClient.get<UserSchoolRole[]>(`/users/${userId}/schools`);
    return response.data;
  },

  /**
   * Add user role for school
   */
  async addUserSchoolRole(
    userId: string,
    schoolId: string,
    role: UserRole,
    customRoleId?: string
  ): Promise<UserSchoolRole> {
    const params: { role: UserRole; custom_role_id?: string } = { role };
    if (customRoleId) {
      params.custom_role_id = customRoleId;
    }
    const response = await apiClient.post<UserSchoolRole>(
      `/users/${userId}/schools/${schoolId}/role`,
      null,
      { params }
    );
    return response.data;
  },

  /**
   * Update user role for school
   */
  async updateUserSchoolRole(
    userId: string,
    schoolId: string,
    role: UserRole,
    customRoleId?: string
  ): Promise<UserSchoolRole> {
    const params: { role: UserRole; custom_role_id?: string } = { role };
    if (customRoleId) {
      params.custom_role_id = customRoleId;
    }
    const response = await apiClient.put<UserSchoolRole>(
      `/users/${userId}/schools/${schoolId}/role`,
      null,
      { params }
    );
    return response.data;
  },

  /**
   * Remove user role from school
   */
  async removeUserSchoolRole(userId: string, schoolId: string): Promise<void> {
    await apiClient.delete(`/users/${userId}/schools/${schoolId}/role`);
  },

  /**
   * Get all users with access to a school
   */
  async getSchoolUsers(schoolId: string): Promise<UserSchoolRole[]> {
    const response = await apiClient.get<UserSchoolRole[]>(`/users/schools/${schoolId}/users`);
    return response.data;
  },

  // ==========================================
  // Email Change (with verification)
  // ==========================================

  /**
   * Request email change - sends verification to new email
   */
  async requestEmailChange(newEmail: string): Promise<{ message: string; email: string }> {
    const response = await apiClient.post<{ message: string; email: string }>(
      '/auth/request-email-change',
      { new_email: newEmail }
    );
    return response.data;
  },

  /**
   * Verify email change token
   */
  async verifyEmailChange(token: string): Promise<{ message: string; old_email: string; new_email: string }> {
    const response = await apiClient.post<{ message: string; old_email: string; new_email: string }>(
      `/auth/verify-email/${token}`
    );
    return response.data;
  },

  // ==========================================
  // Admin User Management
  // ==========================================

  /**
   * Admin reset user password (superuser only)
   */
  async adminResetPassword(userId: string, newPassword: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `/users/${userId}/reset-password`,
      { new_password: newPassword }
    );
    return response.data;
  },

  /**
   * Admin change user email directly (superuser only, no verification)
   */
  async adminChangeEmail(userId: string, newEmail: string): Promise<User> {
    const response = await apiClient.put<User>(
      `/users/${userId}/email`,
      { new_email: newEmail }
    );
    return response.data;
  },

  /**
   * Admin set superuser status (superuser only)
   */
  async adminSetSuperuser(userId: string, isSuperuser: boolean): Promise<User> {
    const response = await apiClient.put<User>(
      `/users/${userId}/superuser`,
      { is_superuser: isSuperuser }
    );
    return response.data;
  },
};
