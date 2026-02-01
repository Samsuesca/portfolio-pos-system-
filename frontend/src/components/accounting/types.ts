/**
 * Shared types for accounting components
 */
import type {
  ExpenseListItem,
  ExpenseCreate, ExpenseCategory, AccPaymentMethod,
  ReceivablesPayablesSummary,
  BalanceAccountCreate, AccountType,
  AccountsReceivableCreate, AccountsReceivableListItem,
  AccountsPayableCreate, AccountsPayableListItem
} from '../../types/api';
import type { CashBalancesResponse } from '../../services/accountingService';
import type {
  GlobalPatrimonySummary,
  GlobalBalanceAccountCreate,
  GlobalBalanceAccountResponse,
  AdjustmentReason,
  ExpenseAdjustmentResponse,
  ExpenseAdjustmentRequest,
  DailyFlowResponse,
  AccountDailyFlow,
  CategoryBreakdown,
  IncomeStatementResponse,
  BalanceSheetResponse,
  PeriodPreset
} from '../../services/globalAccountingService';
import type {
  FixedExpenseListItem,
  FixedExpenseCreate,
  FixedExpenseUpdate,
  FixedExpenseType,
  ExpenseFrequency,
  PendingGenerationResponse
} from '../../services/fixedExpenseService';
import type { PlanningDashboard, CashProjectionResponse, DebtPaymentListResponse } from '../../types/api';

// Tab types
export type TabType = 'summary' | 'expenses' | 'operations' | 'receivables_payables' | 'planning';

// Balance Account Modal Type - uses lowercase values to match backend enum
export type BalanceAccountModalType = 'asset_fixed' | 'liability_current' | 'liability_long';

// Global Dashboard Summary
export interface GlobalDashboardSummary {
  total_expenses: number;
  cash_balance: number;
  expenses_pending: number;
  expenses_paid: number;
  transaction_count: number;
}

// Cash Fallback Data
export interface CashFallbackData {
  expense: ExpenseListItem;
  amount: number;
  sourceBalance: number;
  fallbackBalance: number;
}

/**
 * @deprecated Use useExpenseCategories hook instead for dynamic categories.
 * This constant is kept for backwards compatibility only.
 * Example: const { activeCategories } = useExpenseCategories();
 */
export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'rent', 'utilities', 'payroll', 'supplies', 'inventory',
  'transport', 'maintenance', 'marketing', 'taxes', 'bank_fees', 'other'
];

export const PAYMENT_METHODS: AccPaymentMethod[] = ['cash', 'nequi', 'transfer', 'card', 'credit', 'other'];

// Helper to extract error message from API response
export const getErrorMessage = (err: any, defaultMsg: string): string => {
  const detail = err.response?.data?.detail;
  if (!detail) return defaultMsg;
  if (typeof detail === 'string') return detail;
  // FastAPI validation errors are arrays of objects
  if (Array.isArray(detail)) {
    return detail.map((e: any) => e.msg || e.message || JSON.stringify(e)).join(', ');
  }
  // If it's an object with a message property
  if (typeof detail === 'object' && detail.msg) return detail.msg;
  if (typeof detail === 'object' && detail.message) return detail.message;
  return defaultMsg;
};

// Re-export types for convenience
export type {
  ExpenseListItem,
  ExpenseCreate,
  ExpenseCategory,
  AccPaymentMethod,
  ReceivablesPayablesSummary,
  BalanceAccountCreate,
  AccountType,
  AccountsReceivableCreate,
  AccountsReceivableListItem,
  AccountsPayableCreate,
  AccountsPayableListItem,
  CashBalancesResponse,
  GlobalPatrimonySummary,
  GlobalBalanceAccountCreate,
  GlobalBalanceAccountResponse,
  AdjustmentReason,
  ExpenseAdjustmentResponse,
  ExpenseAdjustmentRequest,
  DailyFlowResponse,
  AccountDailyFlow,
  CategoryBreakdown,
  IncomeStatementResponse,
  BalanceSheetResponse,
  PeriodPreset,
  FixedExpenseListItem,
  FixedExpenseCreate,
  FixedExpenseUpdate,
  FixedExpenseType,
  ExpenseFrequency,
  PendingGenerationResponse,
  PlanningDashboard,
  CashProjectionResponse,
  DebtPaymentListResponse
};
