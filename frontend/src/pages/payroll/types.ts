/**
 * Shared types for the Payroll page and its sub-components.
 */
import type {
  EmployeeCreate,
  EmployeeBonusCreate,
} from '../../services/employeeService';
import type { PayrollRunCreate } from '../../services/payrollService';

export type TabType = 'employees' | 'payroll';

export type ModalType =
  | 'employee'
  | 'bonus'
  | 'payrollCreate'
  | 'payrollDetail'
  | null;

export type EmployeeFilterType = 'active' | 'inactive' | 'all';

export type EmployeeFormData = Partial<EmployeeCreate & { user_id?: string }>;

export type BonusFormData = Partial<EmployeeBonusCreate>;

export type PayrollFormData = Partial<PayrollRunCreate>;

export interface PayrollPreviewItem {
  name: string;
  salary: number;
  frequency: string;
  calculated: number;
}

export interface PayrollPreview {
  totalBase: number;
  periodDays: number;
  breakdown: PayrollPreviewItem[];
  count: number;
}

/**
 * Extract a human-readable error message from an API error response.
 */
export const getErrorMessage = (err: any, defaultMsg: string): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  if (typeof detail === 'object' && detail.msg) return detail.msg;
  return defaultMsg;
};
