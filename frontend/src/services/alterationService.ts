/**
 * Alteration Service - API calls for repairs/alterations portal
 *
 * GLOBAL module - operates business-wide like accounting.
 * Base URL: /api/v1/global/alterations
 */
import apiClient from '../utils/api-client';
import type {
  AlterationListItem,
  AlterationWithPayments,
  AlterationCreate,
  AlterationUpdate,
  AlterationPaymentCreate,
  AlterationPayment,
  AlterationsSummary,
  AlterationStatus,
  AlterationType
} from '../types/api';

const BASE_URL = '/global/alterations';

export interface AlterationFilters {
  skip?: number;
  limit?: number;
  status?: AlterationStatus;
  type?: AlterationType;
  search?: string;
  start_date?: string;
  end_date?: string;
  is_paid?: boolean;
}

export const alterationService = {
  /**
   * List alterations with optional filters
   */
  async getAll(filters?: AlterationFilters): Promise<AlterationListItem[]> {
    const params = new URLSearchParams();

    if (filters?.skip !== undefined) params.append('skip', String(filters.skip));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.is_paid !== undefined) params.append('is_paid', String(filters.is_paid));

    const url = params.toString() ? `${BASE_URL}?${params.toString()}` : BASE_URL;
    const response = await apiClient.get<AlterationListItem[]>(url);
    return response.data;
  },

  /**
   * Get summary statistics for dashboard
   */
  async getSummary(): Promise<AlterationsSummary> {
    const response = await apiClient.get<AlterationsSummary>(`${BASE_URL}/summary`);
    return response.data;
  },

  /**
   * Get alteration by ID with payment history
   */
  async getById(id: string): Promise<AlterationWithPayments> {
    const response = await apiClient.get<AlterationWithPayments>(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Get alteration by code (e.g., ARR-2026-0001)
   */
  async getByCode(code: string): Promise<AlterationWithPayments> {
    const response = await apiClient.get<AlterationWithPayments>(`${BASE_URL}/code/${code}`);
    return response.data;
  },

  /**
   * Create a new alteration
   */
  async create(data: AlterationCreate): Promise<AlterationWithPayments> {
    const response = await apiClient.post<AlterationWithPayments>(BASE_URL, data);
    return response.data;
  },

  /**
   * Update an alteration
   */
  async update(id: string, data: AlterationUpdate): Promise<AlterationWithPayments> {
    const response = await apiClient.patch<AlterationWithPayments>(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  /**
   * Update alteration status only
   */
  async updateStatus(id: string, status: AlterationStatus): Promise<AlterationWithPayments> {
    const response = await apiClient.patch<AlterationWithPayments>(
      `${BASE_URL}/${id}/status`,
      { status }
    );
    return response.data;
  },

  /**
   * Record a payment for an alteration
   */
  async recordPayment(id: string, data: AlterationPaymentCreate): Promise<AlterationPayment> {
    const response = await apiClient.post<AlterationPayment>(
      `${BASE_URL}/${id}/pay`,
      data
    );
    return response.data;
  },

  /**
   * Get payment history for an alteration
   */
  async getPayments(id: string): Promise<AlterationPayment[]> {
    const response = await apiClient.get<AlterationPayment[]>(`${BASE_URL}/${id}/payments`);
    return response.data;
  },

  /**
   * Cancel an alteration (only if no payments recorded)
   */
  async cancel(id: string): Promise<AlterationWithPayments> {
    const response = await apiClient.delete<AlterationWithPayments>(`${BASE_URL}/${id}`);
    return response.data;
  },
};

export default alterationService;
