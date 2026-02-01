import apiClient from '../api';

// Types
export type ExpenseCategory = string;

export type PaymentMethod = 'cash' | 'nequi' | 'transfer' | 'card';

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  amount_paid: number;
  is_paid: boolean;
  expense_date: string;
  due_date?: string;
  vendor?: string;
  receipt_number?: string;
  is_recurring: boolean;
  recurring_period?: string;
  notes?: string;
  balance: number;
  payment_method?: string;
  payment_account_name?: string;
  paid_at?: string;
}

export interface ExpenseCreate {
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  due_date?: string;
  vendor?: string;
  receipt_number?: string;
  is_recurring?: boolean;
  recurring_period?: string;
  notes?: string;
}

export interface ExpensePayment {
  amount: number;
  payment_method: PaymentMethod;
  use_fallback?: boolean;
}

export interface CashBalanceAccount {
  id: string;
  balance: number;
  name: string;
}

export interface CashBalances {
  caja_menor: CashBalanceAccount | null;
  caja_mayor: CashBalanceAccount | null;
  nequi: CashBalanceAccount | null;
  banco: CashBalanceAccount | null;
  total_liquid: number;
}

export interface ExpenseCategorySummary {
  category: string;
  category_label: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  count: number;
  percentage: number;
}

// Expense Category types
export interface ExpenseCategoryListItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  is_system: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export interface ExpenseCategoryFull extends ExpenseCategoryListItem {
  updated_at: string;
}

export interface ExpenseCategoryCreate {
  code: string;
  name: string;
  color: string;
  description?: string;
}

export interface ExpenseCategoryUpdate {
  name?: string;
  color?: string;
  description?: string;
  is_active?: boolean;
}

// Legacy labels for backwards compatibility
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  rent: 'Arriendo',
  utilities: 'Servicios',
  payroll: 'Nómina',
  supplies: 'Suministros',
  inventory: 'Inventario',
  transport: 'Transporte',
  maintenance: 'Mantenimiento',
  marketing: 'Marketing',
  taxes: 'Impuestos',
  bank_fees: 'Comisiones Bancarias',
  other: 'Otros',
};

// Payment method labels
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  credit: 'Crédito',
};

export function getPaymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] || method;
}

const accountingService = {
  // Cash Balances
  async getCashBalances(): Promise<CashBalances> {
    const response = await apiClient.get('/global/accounting/cash-balances');
    return response.data;
  },

  // Expenses
  async listExpenses(params?: {
    category?: string;
    is_paid?: boolean;
    start_date?: string;
    end_date?: string;
    min_amount?: number;
    max_amount?: number;
    payment_account_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<Expense[]> {
    const response = await apiClient.get('/global/accounting/expenses', { params });
    return response.data;
  },

  async getPendingExpenses(): Promise<Expense[]> {
    const response = await apiClient.get('/global/accounting/expenses/pending');
    return response.data;
  },

  async getExpensesSummaryByCategory(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<ExpenseCategorySummary[]> {
    const response = await apiClient.get('/global/accounting/expenses/summary-by-category', { params });
    return response.data;
  },

  async createExpense(data: ExpenseCreate): Promise<Expense> {
    const response = await apiClient.post('/global/accounting/expenses', data);
    return response.data;
  },

  async getExpense(id: string): Promise<Expense> {
    const response = await apiClient.get(`/global/accounting/expenses/${id}`);
    return response.data;
  },

  async updateExpense(id: string, data: Partial<ExpenseCreate>): Promise<Expense> {
    const response = await apiClient.patch(`/global/accounting/expenses/${id}`, data);
    return response.data;
  },

  async deleteExpense(id: string): Promise<void> {
    await apiClient.delete(`/global/accounting/expenses/${id}`);
  },

  async payExpense(id: string, payment: ExpensePayment): Promise<Expense> {
    const response = await apiClient.post(`/global/accounting/expenses/${id}/pay`, payment);
    return response.data;
  },

  async checkExpenseBalance(amount: number, payment_method: PaymentMethod): Promise<{
    can_pay: boolean;
    source: string;
    source_balance: number;
    fallback_available: boolean;
    fallback_source: string | null;
    fallback_balance: number | null;
  }> {
    const response = await apiClient.post('/global/accounting/expenses/check-balance', null, {
      params: { amount, payment_method }
    });
    return response.data;
  },

  // Expense Categories
  async getExpenseCategories(includeInactive?: boolean): Promise<ExpenseCategoryListItem[]> {
    const params: Record<string, unknown> = {};
    if (includeInactive) {
      params.include_inactive = true;
    }
    const response = await apiClient.get('/global/accounting/expense-categories', { params });
    return response.data;
  },

  async createExpenseCategory(data: ExpenseCategoryCreate): Promise<ExpenseCategoryFull> {
    const response = await apiClient.post('/global/accounting/expense-categories', data);
    return response.data;
  },

  async updateExpenseCategory(id: string, data: ExpenseCategoryUpdate): Promise<ExpenseCategoryFull> {
    const response = await apiClient.patch(`/global/accounting/expense-categories/${id}`, data);
    return response.data;
  },

  async deleteExpenseCategory(id: string): Promise<void> {
    await apiClient.delete(`/global/accounting/expense-categories/${id}`);
  },

  async permanentDeleteExpenseCategory(id: string): Promise<void> {
    await apiClient.delete(`/global/accounting/expense-categories/${id}/permanent`);
  },
};

export default accountingService;
