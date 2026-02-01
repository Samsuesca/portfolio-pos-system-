/**
 * Employee Service - API calls for employee management
 */
import apiClient from '../api';

const BASE_URL = '/global/employees';

// ============================================
// Types
// ============================================

export type PaymentFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';
export type BonusType = 'fixed' | 'variable' | 'one_time';

export interface EmployeeListItem {
  id: string;
  full_name: string;
  document_id: string;
  position: string;
  hire_date: string;
  base_salary: number;
  payment_frequency: PaymentFrequency;
  is_active: boolean;
}

export interface EmployeeCreate {
  full_name: string;
  document_type?: string;
  document_id: string;
  email?: string;
  phone?: string;
  address?: string;
  position: string;
  hire_date: string;
  base_salary: number;
  payment_frequency?: PaymentFrequency;
  payment_method?: string;
  bank_name?: string;
  bank_account?: string;
  health_deduction?: number;
  pension_deduction?: number;
  other_deductions?: number;
  user_id?: string;
}

export interface EmployeeUpdate {
  full_name?: string;
  document_type?: string;
  document_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  position?: string;
  termination_date?: string;
  is_active?: boolean;
  base_salary?: number;
  payment_frequency?: PaymentFrequency;
  payment_method?: string;
  bank_name?: string;
  bank_account?: string;
  health_deduction?: number;
  pension_deduction?: number;
  other_deductions?: number;
}

export interface EmployeeResponse extends EmployeeListItem {
  document_type: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  termination_date: string | null;
  payment_method: string;
  bank_name: string | null;
  bank_account: string | null;
  health_deduction: number;
  pension_deduction: number;
  other_deductions: number;
  total_deductions: number;
  user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeBonusCreate {
  name: string;
  bonus_type: BonusType;
  amount: number;
  is_recurring?: boolean;
  start_date: string;
  end_date?: string;
  notes?: string;
}

export interface EmployeeBonusUpdate {
  name?: string;
  bonus_type?: BonusType;
  amount?: number;
  is_recurring?: boolean;
  end_date?: string;
  is_active?: boolean;
  notes?: string;
}

export interface EmployeeBonusResponse {
  id: string;
  employee_id: string;
  name: string;
  bonus_type: BonusType;
  amount: number;
  is_recurring: boolean;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeTotals {
  base_salary: number;
  total_bonuses: number;
  total_deductions: number;
  net_amount: number;
  bonus_breakdown: { name: string; amount: number }[];
  deduction_breakdown: { name: string; amount: number }[];
}

// Helper constants
export const PAYMENT_FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
};

export const BONUS_TYPE_LABELS: Record<BonusType, string> = {
  fixed: 'Fijo',
  variable: 'Variable',
  one_time: 'Único',
};

// ============================================
// API Functions
// ============================================

const employeeService = {
  // List all employees
  list: async (params?: {
    skip?: number;
    limit?: number;
    is_active?: boolean;
  }): Promise<EmployeeListItem[]> => {
    const response = await apiClient.get<EmployeeListItem[]>(BASE_URL, { params });
    return response.data;
  },

  // Get a single employee by ID
  getById: async (id: string): Promise<EmployeeResponse> => {
    const response = await apiClient.get<EmployeeResponse>(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create a new employee
  create: async (data: EmployeeCreate): Promise<EmployeeResponse> => {
    const response = await apiClient.post<EmployeeResponse>(BASE_URL, data);
    return response.data;
  },

  // Update an employee
  update: async (id: string, data: EmployeeUpdate): Promise<EmployeeResponse> => {
    const response = await apiClient.patch<EmployeeResponse>(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete (deactivate) an employee
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`${BASE_URL}/${id}`);
  },

  // Get employee's calculated totals
  getTotals: async (id: string): Promise<EmployeeTotals> => {
    const response = await apiClient.get<EmployeeTotals>(`${BASE_URL}/${id}/totals`);
    return response.data;
  },

  // List all bonuses for an employee
  getBonuses: async (
    employeeId: string,
    params?: { is_active?: boolean }
  ): Promise<EmployeeBonusResponse[]> => {
    const response = await apiClient.get<EmployeeBonusResponse[]>(
      `${BASE_URL}/${employeeId}/bonuses`,
      { params }
    );
    return response.data;
  },

  // Create a bonus for an employee
  createBonus: async (
    employeeId: string,
    data: EmployeeBonusCreate
  ): Promise<EmployeeBonusResponse> => {
    const response = await apiClient.post<EmployeeBonusResponse>(
      `${BASE_URL}/${employeeId}/bonuses`,
      data
    );
    return response.data;
  },

  // Update a bonus
  updateBonus: async (
    bonusId: string,
    data: EmployeeBonusUpdate
  ): Promise<EmployeeBonusResponse> => {
    const response = await apiClient.patch<EmployeeBonusResponse>(
      `${BASE_URL}/bonuses/${bonusId}`,
      data
    );
    return response.data;
  },

  // Delete (deactivate) a bonus
  deleteBonus: async (bonusId: string): Promise<void> => {
    await apiClient.delete(`${BASE_URL}/bonuses/${bonusId}`);
  },
};

export default employeeService;
