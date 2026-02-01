/**
 * Fixed Expense Service - API calls for recurring/periodic expense templates
 *
 * Fixed expenses are templates for recurring expenses (rent, utilities, etc.)
 * that automatically generate pending Expense records at specified intervals.
 */
import apiClient from '../utils/api-client';
import type { ExpenseCategory } from '../types/api';

const BASE_URL = '/global/fixed-expenses';

// ============================================
// Types
// ============================================

export type FixedExpenseType = 'exact' | 'variable';
export type ExpenseFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

// New advanced recurrence types
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type MonthDayType = 'specific' | 'last_day' | 'first_weekday' | 'last_weekday';

export interface FixedExpenseListItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  expense_type: FixedExpenseType;
  amount: number;
  min_amount: number | null;
  max_amount: number | null;
  // Legacy
  frequency: ExpenseFrequency | null;
  day_of_month: number | null;
  // New recurrence
  recurrence_frequency?: RecurrenceFrequency | null;
  recurrence_interval?: number | null;
  recurrence_weekdays?: WeekDay[] | null;
  recurrence_month_days?: number[] | null;
  recurrence_month_day_type?: MonthDayType | null;
  uses_new_recurrence?: boolean;
  // Common
  vendor: string | null;
  auto_generate: boolean;
  next_generation_date: string | null;
  last_generated_date: string | null;
  is_active: boolean;
}

export interface FixedExpenseCreate {
  name: string;
  description?: string;
  category: ExpenseCategory;
  expense_type: FixedExpenseType;
  amount: number;
  min_amount?: number;
  max_amount?: number;
  // Legacy frequency
  frequency?: ExpenseFrequency;
  day_of_month?: number;
  // New recurrence system
  recurrence_frequency?: RecurrenceFrequency;
  recurrence_interval?: number;
  recurrence_weekdays?: WeekDay[];
  recurrence_month_days?: number[];
  recurrence_month_day_type?: MonthDayType;
  recurrence_start_date?: string;
  recurrence_end_date?: string;
  recurrence_max_occurrences?: number;
  // Common
  auto_generate?: boolean;
  next_generation_date?: string;
  vendor?: string;
}

export interface FixedExpenseUpdate {
  name?: string;
  description?: string;
  category?: ExpenseCategory;
  expense_type?: FixedExpenseType;
  amount?: number;
  min_amount?: number;
  max_amount?: number;
  // Legacy frequency
  frequency?: ExpenseFrequency;
  day_of_month?: number;
  // New recurrence system
  recurrence_frequency?: RecurrenceFrequency;
  recurrence_interval?: number;
  recurrence_weekdays?: WeekDay[];
  recurrence_month_days?: number[];
  recurrence_month_day_type?: MonthDayType;
  recurrence_start_date?: string;
  recurrence_end_date?: string;
  recurrence_max_occurrences?: number;
  // Common
  auto_generate?: boolean;
  next_generation_date?: string;
  vendor?: string;
  is_active?: boolean;
}

export interface FixedExpenseResponse extends FixedExpenseListItem {
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FixedExpenseWithStats extends FixedExpenseResponse {
  total_generated: number;
  total_amount_generated: number;
  last_expense_id: string | null;
}

// Generation types
export interface GenerateExpensesRequest {
  fixed_expense_ids?: string[];
  target_date?: string;
  override_amounts?: Record<string, number>;
}

export interface GeneratedExpenseInfo {
  fixed_expense_id: string;
  fixed_expense_name: string;
  expense_id: string;
  amount: number;
  expense_date: string;
  due_date: string | null;
}

export interface GenerateExpensesResponse {
  generated_count: number;
  skipped_count: number;
  generated_expenses: GeneratedExpenseInfo[];
  skipped_reasons: Record<string, string>;
}

export interface PendingGenerationItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  expense_type: FixedExpenseType;
  amount: number;
  min_amount: number | null;
  max_amount: number | null;
  frequency: ExpenseFrequency;
  next_generation_date: string | null;
  last_generated_date: string | null;
  days_overdue: number;
}

export interface PendingGenerationResponse {
  pending_count: number;
  overdue_count: number;
  items: PendingGenerationItem[];
}

export interface ExpenseHistoryItem {
  id: string;
  description: string;
  amount: number;
  amount_paid: number;
  balance: number;
  is_paid: boolean;
  expense_date: string;
  due_date: string | null;
  payment_method: string | null;
  paid_at: string | null;
}

// ============================================
// API Functions
// ============================================

/**
 * List all fixed expense templates
 */
export const getFixedExpenses = async (params?: {
  skip?: number;
  limit?: number;
  is_active?: boolean;
  category?: ExpenseCategory;
}): Promise<FixedExpenseListItem[]> => {
  const response = await apiClient.get<FixedExpenseListItem[]>(BASE_URL, { params });
  return response.data;
};

/**
 * Get a single fixed expense with statistics
 */
export const getFixedExpense = async (id: string): Promise<FixedExpenseWithStats> => {
  const response = await apiClient.get<FixedExpenseWithStats>(`${BASE_URL}/${id}`);
  return response.data;
};

/**
 * Create a new fixed expense template
 */
export const createFixedExpense = async (data: FixedExpenseCreate): Promise<FixedExpenseResponse> => {
  const response = await apiClient.post<FixedExpenseResponse>(BASE_URL, data);
  return response.data;
};

/**
 * Update a fixed expense template
 */
export const updateFixedExpense = async (
  id: string,
  data: FixedExpenseUpdate
): Promise<FixedExpenseResponse> => {
  const response = await apiClient.patch<FixedExpenseResponse>(`${BASE_URL}/${id}`, data);
  return response.data;
};

/**
 * Delete (deactivate) a fixed expense template
 */
export const deleteFixedExpense = async (id: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/${id}`);
};

/**
 * Get fixed expenses pending generation
 */
export const getPendingGeneration = async (): Promise<PendingGenerationResponse> => {
  const response = await apiClient.get<PendingGenerationResponse>(`${BASE_URL}/pending-generation`);
  return response.data;
};

/**
 * Generate expenses from fixed expense templates
 * If no request body, generates all due expenses for today
 */
export const generateExpenses = async (
  request?: GenerateExpensesRequest
): Promise<GenerateExpensesResponse> => {
  const response = await apiClient.post<GenerateExpensesResponse>(`${BASE_URL}/generate`, request || {});
  return response.data;
};

/**
 * Generate a single expense from a fixed expense template
 */
export const generateSingleExpense = async (
  fixedExpenseId: string,
  params?: { amount?: number; expense_date?: string }
): Promise<{
  message: string;
  expense_id: string;
  amount: number;
  expense_date: string;
  due_date: string | null;
}> => {
  const response = await apiClient.post<{
    message: string;
    expense_id: string;
    amount: number;
    expense_date: string;
    due_date: string | null;
  }>(`${BASE_URL}/${fixedExpenseId}/generate`, null, { params });
  return response.data;
};

/**
 * Get expense history for a fixed expense template
 */
export const getExpenseHistory = async (
  fixedExpenseId: string,
  limit: number = 12
): Promise<ExpenseHistoryItem[]> => {
  const response = await apiClient.get<ExpenseHistoryItem[]>(
    `${BASE_URL}/${fixedExpenseId}/history`,
    { params: { limit } }
  );
  return response.data;
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get human-readable label for expense type
 */
export const getExpenseTypeLabel = (type: FixedExpenseType): string => {
  const labels: Record<FixedExpenseType, string> = {
    exact: 'Valor Fijo',
    variable: 'Valor Variable'
  };
  return labels[type] || type;
};

/**
 * Get human-readable label for frequency
 */
export const getFrequencyLabel = (frequency: ExpenseFrequency): string => {
  const labels: Record<ExpenseFrequency, string> = {
    weekly: 'Semanal',
    biweekly: 'Quincenal',
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    yearly: 'Anual'
  };
  return labels[frequency] || frequency;
};

/**
 * Get color class for expense type
 */
export const getExpenseTypeColor = (type: FixedExpenseType): string => {
  const colors: Record<FixedExpenseType, string> = {
    exact: 'bg-blue-100 text-blue-800',
    variable: 'bg-amber-100 text-amber-800'
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

/**
 * Get color class for status
 */
export const getStatusColor = (isActive: boolean, daysOverdue: number): string => {
  if (!isActive) return 'bg-gray-100 text-gray-600';
  if (daysOverdue > 0) return 'bg-red-100 text-red-800';
  return 'bg-green-100 text-green-800';
};

/**
 * Format amount range for variable expenses
 */
export const formatAmountRange = (
  amount: number,
  minAmount: number | null,
  maxAmount: number | null,
  expenseType: FixedExpenseType
): string => {
  if (expenseType === 'variable' && minAmount !== null && maxAmount !== null) {
    return `$${minAmount.toLocaleString('es-CO')} - $${maxAmount.toLocaleString('es-CO')}`;
  }
  return `$${amount.toLocaleString('es-CO')}`;
};

export default {
  getFixedExpenses,
  getFixedExpense,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  getPendingGeneration,
  generateExpenses,
  generateSingleExpense,
  getExpenseHistory,
  getExpenseTypeLabel,
  getFrequencyLabel,
  getExpenseTypeColor,
  getStatusColor,
  formatAmountRange
};
