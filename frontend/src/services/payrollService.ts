/**
 * Payroll Service - API calls for payroll management
 */
import apiClient from '../utils/api-client';

const BASE_URL = '/global/payroll';

// ============================================
// Types
// ============================================

export type PayrollStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

export interface PayrollRunListItem {
  id: string;
  period_start: string;
  period_end: string;
  payment_date: string | null;
  status: PayrollStatus;
  total_net: number;
  employee_count: number;
  created_at: string;
}

export interface PayrollRunCreate {
  period_start: string;
  period_end: string;
  payment_date?: string;
  notes?: string;
  employee_ids?: string[];
}

export interface PayrollRunUpdate {
  payment_date?: string;
  notes?: string;
}

export interface PayrollItemResponse {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  base_salary: number;
  total_bonuses: number;
  total_deductions: number;
  net_amount: number;
  bonus_breakdown: { name: string; amount: number }[] | null;
  deduction_breakdown: { name: string; amount: number }[] | null;
  // Days-based calculation info
  worked_days: number | null;
  daily_rate: number | null;
  // Payment status
  is_paid: boolean;
  paid_at: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  employee_name: string | null;
  employee_payment_frequency: string | null;
}

export interface PayrollRunResponse {
  id: string;
  period_start: string;
  period_end: string;
  payment_date: string | null;
  status: PayrollStatus;
  total_base_salary: number;
  total_bonuses: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
  expense_id: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PayrollRunDetailResponse extends PayrollRunResponse {
  items: PayrollItemResponse[];
}

export interface PayrollItemPayRequest {
  payment_method: string;
  payment_reference?: string;
}

export interface FixedExpenseIntegration {
  id: string;
  amount: number;
  is_synced: boolean;
  updated_at: string | null;
}

export interface PayrollSummary {
  active_employees: number;
  total_monthly_payroll: number;
  pending_payroll_runs: number;
  last_payroll_date: string | null;
  fixed_expense_integration: FixedExpenseIntegration | null;
}

// ============================================
// API Functions
// ============================================

/**
 * Get payroll summary
 */
export const getPayrollSummary = async (): Promise<PayrollSummary> => {
  const response = await apiClient.get<PayrollSummary>(`${BASE_URL}/summary`);
  return response.data;
};

/**
 * List all payroll runs
 */
export const getPayrollRuns = async (params?: {
  skip?: number;
  limit?: number;
  status?: PayrollStatus;
}): Promise<PayrollRunListItem[]> => {
  const response = await apiClient.get<PayrollRunListItem[]>(BASE_URL, { params });
  return response.data;
};

/**
 * Get a single payroll run with items
 */
export const getPayrollRun = async (id: string): Promise<PayrollRunDetailResponse> => {
  const response = await apiClient.get<PayrollRunDetailResponse>(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Create a new payroll run
 */
export const createPayrollRun = async (data: PayrollRunCreate): Promise<PayrollRunResponse> => {
  const response = await apiClient.post<PayrollRunResponse>(BASE_URL, data);
  return response.data;
};

/**
 * Update a payroll run (only in draft status)
 */
export const updatePayrollRun = async (
  id: string,
  data: PayrollRunUpdate
): Promise<PayrollRunResponse> => {
  const response = await apiClient.patch<PayrollRunResponse>(`${BASE_URL}/${id}`, data);
  return response.data;
};

/**
 * Approve a payroll run (creates expense)
 */
export const approvePayrollRun = async (id: string): Promise<PayrollRunResponse> => {
  const response = await apiClient.post<PayrollRunResponse>(`${BASE_URL}/${id}/approve`);
  return response.data;
};

/**
 * Mark entire payroll as paid
 */
export const payPayrollRun = async (id: string): Promise<PayrollRunResponse> => {
  const response = await apiClient.post<PayrollRunResponse>(`${BASE_URL}/${id}/pay`);
  return response.data;
};

/**
 * Cancel a payroll run
 */
export const cancelPayrollRun = async (id: string): Promise<PayrollRunResponse> => {
  const response = await apiClient.post<PayrollRunResponse>(`${BASE_URL}/${id}/cancel`);
  return response.data;
};

/**
 * Pay a single employee in the payroll
 */
export const payPayrollItem = async (
  payrollId: string,
  itemId: string,
  data: PayrollItemPayRequest
): Promise<PayrollItemResponse> => {
  const response = await apiClient.post<PayrollItemResponse>(
    `${BASE_URL}/${payrollId}/items/${itemId}/pay`,
    data
  );
  return response.data;
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get human-readable label for payroll status
 */
export const getPayrollStatusLabel = (status: PayrollStatus): string => {
  const labels: Record<PayrollStatus, string> = {
    draft: 'Borrador',
    approved: 'Aprobado',
    paid: 'Pagado',
    cancelled: 'Cancelado'
  };
  return labels[status] || status;
};

/**
 * Get color class for payroll status
 */
export const getPayrollStatusColor = (status: PayrollStatus): string => {
  const colors: Record<PayrollStatus, string> = {
    draft: 'bg-gray-100 text-gray-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

/**
 * Format period range
 */
export const formatPeriodRange = (start: string, end: string): string => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  return `${startDate.toLocaleDateString('es-CO', options)} - ${endDate.toLocaleDateString('es-CO', options)}`;
};

// Import and re-export formatCurrency for backwards compatibility
import { formatCurrency } from '../utils/formatting';
export { formatCurrency };

export default {
  getPayrollSummary,
  getPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  updatePayrollRun,
  approvePayrollRun,
  payPayrollRun,
  cancelPayrollRun,
  payPayrollItem,
  getPayrollStatusLabel,
  getPayrollStatusColor,
  formatPeriodRange,
  formatCurrency
};
