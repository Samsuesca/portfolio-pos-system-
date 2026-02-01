import apiClient, { PaymentAccount } from '../api';

export interface CreatePaymentAccountData {
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

export interface UpdatePaymentAccountData {
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

const paymentAccountService = {
  // List all payment accounts (admin - includes inactive)
  list: async () => {
    const response = await apiClient.get<PaymentAccount[]>('/payment-accounts');
    return response.data;
  },

  // Get payment account by ID
  getById: async (id: string) => {
    const response = await apiClient.get<PaymentAccount>(`/payment-accounts/${id}`);
    return response.data;
  },

  // Create new payment account
  create: async (data: CreatePaymentAccountData) => {
    const response = await apiClient.post<PaymentAccount>('/payment-accounts', data);
    return response.data;
  },

  // Update payment account
  update: async (id: string, data: UpdatePaymentAccountData) => {
    const response = await apiClient.put<PaymentAccount>(`/payment-accounts/${id}`, data);
    return response.data;
  },

  // Delete payment account
  delete: async (id: string) => {
    const response = await apiClient.delete(`/payment-accounts/${id}`);
    return response.data;
  },
};

export default paymentAccountService;
