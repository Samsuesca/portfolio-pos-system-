import apiClient from '../utils/apiClient';
import type {
  CashBalancesResponse,
  DailyFlowResponse,
  ExpenseListItem,
  ExpenseDetail,
  ExpenseCreate,
  ExpensePayment,
  ExpenseCategory,
  ReceivableListItem,
  ReceivablePayment,
} from '../types/api';

interface ExpenseListParams {
  category?: string;
  is_paid?: boolean;
  start_date?: string;
  end_date?: string;
  skip?: number;
  limit?: number;
}

interface ReceivableListParams {
  is_paid?: boolean;
  skip?: number;
  limit?: number;
}

export const accountingService = {
  getCashBalances: () =>
    apiClient.get<CashBalancesResponse>('/global/accounting/cash-balances'),

  getDailyFlow: (targetDate?: string) =>
    apiClient.get<DailyFlowResponse>('/global/accounting/daily-flow', {
      params: targetDate ? { target_date: targetDate } : undefined,
    }),

  getExpenses: (params: ExpenseListParams) =>
    apiClient.get<{ items: ExpenseListItem[] }>('/global/accounting/expenses', { params })
      .then(r => ({ ...r, data: r.data.items })),

  getExpenseDetail: (expenseId: string) =>
    apiClient.get<ExpenseDetail>(`/global/accounting/expenses/${expenseId}`),

  createExpense: (data: ExpenseCreate) =>
    apiClient.post<ExpenseDetail>('/global/accounting/expenses', data),

  payExpense: (expenseId: string, data: ExpensePayment) =>
    apiClient.post<ExpenseDetail>(`/global/accounting/expenses/${expenseId}/pay`, data),

  deleteExpense: (expenseId: string) =>
    apiClient.delete(`/global/accounting/expenses/${expenseId}`),

  getExpenseCategories: () =>
    apiClient.get<ExpenseCategory[]>('/global/accounting/expense-categories'),

  getReceivables: (params: ReceivableListParams) =>
    apiClient.get<{ items: ReceivableListItem[] }>('/global/accounting/receivables', { params })
      .then(r => ({ ...r, data: r.data.items })),

  getPendingReceivables: () =>
    apiClient.get<ReceivableListItem[]>('/global/accounting/receivables/pending'),

  payReceivable: (receivableId: string, data: ReceivablePayment) =>
    apiClient.post<unknown>(`/global/accounting/receivables/${receivableId}/pay`, data),
};
