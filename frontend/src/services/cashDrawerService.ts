/**
 * Cash Drawer Service - API calls for cash drawer access control
 */
import apiClient from '../utils/api-client';

export interface CanOpenResponse {
  can_open_directly: boolean;
  reason: 'superuser' | 'has_permission' | 'no_permission';
}

export interface RequestAccessResponse {
  message: string;
  expires_in: number;  // seconds
  expires_at: string;  // ISO datetime
}

export interface ValidateAccessResponse {
  valid: boolean;
  message: string;
}

export interface OpenDrawerResponse {
  authorized: boolean;
  reason: 'superuser' | 'has_permission';
}

export const cashDrawerService = {
  /**
   * Check if current user can open drawer directly
   */
  async canOpenDirectly(): Promise<CanOpenResponse> {
    const response = await apiClient.get<CanOpenResponse>('/cash-drawer/can-open');
    return response.data;
  },

  /**
   * Request access code for drawer opening
   * Code will be sent to all superusers via email
   */
  async requestAccess(): Promise<RequestAccessResponse> {
    const response = await apiClient.post<RequestAccessResponse>('/cash-drawer/request-access');
    return response.data;
  },

  /**
   * Validate access code
   */
  async validateAccess(code: string): Promise<ValidateAccessResponse> {
    const response = await apiClient.post<ValidateAccessResponse>('/cash-drawer/validate-access', {
      code
    });
    return response.data;
  },

  /**
   * Open drawer directly (requires permission or superuser)
   */
  async openDirect(): Promise<OpenDrawerResponse> {
    const response = await apiClient.post<OpenDrawerResponse>('/cash-drawer/open');
    return response.data;
  },
};
