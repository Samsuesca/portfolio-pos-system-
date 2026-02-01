/**
 * Alteration Service - API calls for repairs/alterations portal
 *
 * GLOBAL module - operates business-wide like accounting.
 * Base URL: /api/v1/global/alterations
 */
import apiClient, { PaymentMethod } from '../api';

const BASE_URL = '/global/alterations';

// Types
export type AlterationType =
  | 'hem'
  | 'length'
  | 'width'
  | 'seam'
  | 'buttons'
  | 'zipper'
  | 'patch'
  | 'darts'
  | 'other';

export type AlterationStatus =
  | 'pending'
  | 'in_progress'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export const ALTERATION_TYPE_LABELS: Record<AlterationType, string> = {
  hem: 'Dobladillo',
  length: 'Largo',
  width: 'Ancho',
  seam: 'Costura',
  buttons: 'Botones',
  zipper: 'Cremallera',
  patch: 'Parche',
  darts: 'Pinzas',
  other: 'Otro',
};

export const ALTERATION_STATUS_LABELS: Record<AlterationStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En Proceso',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const ALTERATION_STATUS_COLORS: Record<AlterationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-emerald-600 text-white',
  cancelled: 'bg-red-100 text-red-800',
};

export interface Alteration {
  id: string;
  code: string;
  client_id: string | null;
  external_client_name: string | null;
  external_client_phone: string | null;
  alteration_type: AlterationType;
  garment_name: string;
  description: string;
  cost: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  status: AlterationStatus;
  received_date: string;
  estimated_delivery_date: string | null;
  delivered_date: string | null;
  notes: string | null;
  client_display_name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlterationListItem {
  id: string;
  code: string;
  client_display_name: string;
  alteration_type: AlterationType;
  garment_name: string;
  cost: number;
  amount_paid: number;
  balance: number;
  status: AlterationStatus;
  received_date: string;
  estimated_delivery_date: string | null;
  is_paid: boolean;
}

export interface AlterationPayment {
  id: string;
  alteration_id: string;
  amount: number;
  payment_method: string;
  notes: string | null;
  transaction_id: string | null;
  created_by: string | null;
  created_at: string;
  created_by_username: string | null;
}

export interface AlterationWithPayments extends Alteration {
  payments: AlterationPayment[];
}

export interface AlterationCreate {
  client_id?: string;
  external_client_name?: string;
  external_client_phone?: string;
  alteration_type: AlterationType;
  garment_name: string;
  description: string;
  cost: number;
  received_date: string;
  estimated_delivery_date?: string;
  notes?: string;
  initial_payment?: number;
  initial_payment_method?: PaymentMethod;
}

export interface AlterationUpdate {
  alteration_type?: AlterationType;
  garment_name?: string;
  description?: string;
  cost?: number;
  status?: AlterationStatus;
  estimated_delivery_date?: string;
  delivered_date?: string;
  notes?: string;
}

export interface AlterationPaymentCreate {
  amount: number;
  payment_method: PaymentMethod;
  notes?: string;
  apply_accounting?: boolean;
}

export interface AlterationsSummary {
  total_count: number;
  pending_count: number;
  in_progress_count: number;
  ready_count: number;
  delivered_count: number;
  cancelled_count: number;
  total_revenue: number;
  total_pending_payment: number;
  today_received: number;
  today_delivered: number;
}

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

const alterationService = {
  // List alterations with optional filters
  list: async (filters?: AlterationFilters): Promise<AlterationListItem[]> => {
    const params: Record<string, string> = {};

    if (filters?.skip !== undefined) params.skip = String(filters.skip);
    if (filters?.limit !== undefined) params.limit = String(filters.limit);
    if (filters?.status) params.status = filters.status;
    if (filters?.type) params.type = filters.type;
    if (filters?.search) params.search = filters.search;
    if (filters?.start_date) params.start_date = filters.start_date;
    if (filters?.end_date) params.end_date = filters.end_date;
    if (filters?.is_paid !== undefined) params.is_paid = String(filters.is_paid);

    const response = await apiClient.get<AlterationListItem[]>(BASE_URL, { params });
    return response.data;
  },

  // Get summary statistics for dashboard
  getSummary: async (): Promise<AlterationsSummary> => {
    const response = await apiClient.get<AlterationsSummary>(`${BASE_URL}/summary`);
    return response.data;
  },

  // Get alteration by ID with payment history
  getById: async (id: string): Promise<AlterationWithPayments> => {
    const response = await apiClient.get<AlterationWithPayments>(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Get alteration by code (e.g., ARR-2026-0001)
  getByCode: async (code: string): Promise<AlterationWithPayments> => {
    const response = await apiClient.get<AlterationWithPayments>(`${BASE_URL}/code/${code}`);
    return response.data;
  },

  // Create a new alteration
  create: async (data: AlterationCreate): Promise<AlterationWithPayments> => {
    const response = await apiClient.post<AlterationWithPayments>(BASE_URL, data);
    return response.data;
  },

  // Update an alteration
  update: async (id: string, data: AlterationUpdate): Promise<AlterationWithPayments> => {
    const response = await apiClient.patch<AlterationWithPayments>(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Update alteration status only
  updateStatus: async (id: string, status: AlterationStatus): Promise<AlterationWithPayments> => {
    const response = await apiClient.patch<AlterationWithPayments>(
      `${BASE_URL}/${id}/status`,
      { status }
    );
    return response.data;
  },

  // Record a payment for an alteration
  recordPayment: async (id: string, data: AlterationPaymentCreate): Promise<AlterationPayment> => {
    const response = await apiClient.post<AlterationPayment>(
      `${BASE_URL}/${id}/pay`,
      data
    );
    return response.data;
  },

  // Get payment history for an alteration
  getPayments: async (id: string): Promise<AlterationPayment[]> => {
    const response = await apiClient.get<AlterationPayment[]>(`${BASE_URL}/${id}/payments`);
    return response.data;
  },

  // Cancel an alteration (only if no payments recorded)
  cancel: async (id: string): Promise<AlterationWithPayments> => {
    const response = await apiClient.delete<AlterationWithPayments>(`${BASE_URL}/${id}`);
    return response.data;
  },
};

export default alterationService;
