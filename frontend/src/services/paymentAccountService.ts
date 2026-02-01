/**
 * Payment Account Service
 *
 * API client for managing payment accounts (bank accounts, Nequi, QR codes).
 * Admin configures these in desktop app, displayed to customers in web portal.
 */
import apiClient from '../utils/api-client';

export interface PaymentAccount {
  id: string;
  method_type: string;
  account_name: string;
  account_number: string;
  account_holder: string;
  bank_name: string | null;
  account_type: string | null;
  qr_code_url: string | null;
  instructions: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentAccountCreate {
  method_type: string;
  account_name: string;
  account_number: string;
  account_holder: string;
  bank_name?: string;
  account_type?: string;
  qr_code_url?: string;
  instructions?: string;
  display_order?: number;
  is_active?: boolean;
}

export interface PaymentAccountUpdate {
  method_type?: string;
  account_name?: string;
  account_number?: string;
  account_holder?: string;
  bank_name?: string;
  account_type?: string;
  qr_code_url?: string;
  instructions?: string;
  display_order?: number;
  is_active?: boolean;
}

class PaymentAccountService {
  /**
   * List all payment accounts (admin - includes inactive)
   */
  async getAll(): Promise<PaymentAccount[]> {
    const response = await apiClient.get<PaymentAccount[]>('/payment-accounts');
    return response.data;
  }

  /**
   * Get public payment accounts (active only - for web portal)
   */
  async getPublic(): Promise<PaymentAccount[]> {
    const response = await apiClient.get<PaymentAccount[]>('/payment-accounts/public');
    return response.data;
  }

  /**
   * Get payment account by ID
   */
  async getById(id: string): Promise<PaymentAccount> {
    const response = await apiClient.get<PaymentAccount>(`/payment-accounts/${id}`);
    return response.data;
  }

  /**
   * Create new payment account
   */
  async create(data: PaymentAccountCreate): Promise<PaymentAccount> {
    const response = await apiClient.post<PaymentAccount>('/payment-accounts', data);
    return response.data;
  }

  /**
   * Update payment account
   */
  async update(id: string, data: PaymentAccountUpdate): Promise<PaymentAccount> {
    const response = await apiClient.put<PaymentAccount>(`/payment-accounts/${id}`, data);
    return response.data;
  }

  /**
   * Delete payment account
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/payment-accounts/${id}`);
  }
}

export const paymentAccountService = new PaymentAccountService();
