/**
 * Global Accounting Service - API calls for global (business-wide) accounting
 *
 * These endpoints operate on global accounts (school_id = NULL) for:
 * - Cash (Caja) and Bank (Banco) balances
 * - Business expenses
 * - Accounts payable (suppliers)
 * - Balance general
 */
import apiClient from '../utils/api-client';
import type {
  ExpenseListItem,
  ExpenseCreate,
  Expense,
  ExpensePayment,
  BalanceAccountListItem,
  BalanceAccount,
  AccountsPayableCreate,
  AccountsPayable,
  AccountsPayablePayment,
  AccountsPayableListItem,
  AccountType,
  ExpenseCategory,
  AccPaymentMethod,
  // Financial Planning types
  DebtPaymentCreate,
  DebtPaymentListResponse,
  SalesSeasonalityResponse,
  CashProjectionParams,
  CashProjectionResponse,
  PlanningDashboard
} from '../types/api';

// Re-export types for components that import from this service
export type { ExpenseListItem, ExpensePayment, ExpenseCategory, AccPaymentMethod } from '../types/api';

const BASE_URL = '/global/accounting';

// ============================================
// Global Cash Balances (Caja y Banco)
// ============================================

export interface GlobalCashBalanceInfo {
  id: string;
  name: string;
  balance: number;
  last_updated: string | null;
}

export interface GlobalCashBalancesResponse {
  // Legacy fields
  caja: GlobalCashBalanceInfo | null;
  banco: GlobalCashBalanceInfo | null;
  total_liquid: number;
  // New 4-account structure
  caja_menor?: GlobalCashBalanceInfo | null;
  caja_mayor?: GlobalCashBalanceInfo | null;
  nequi?: GlobalCashBalanceInfo | null;
  total_cash?: number;
}

// Caja Menor / Liquidation types
export interface GlobalCajaMenorSummary {
  caja_menor_balance: number;
  caja_mayor_balance: number;
  today_liquidations: number;
  today_entries_count: number;
  date: string;
}

export interface GlobalLiquidationResult {
  success: boolean;
  message: string;
  caja_menor_balance: number;
  caja_mayor_balance: number;
  amount_liquidated: number;
}

export interface GlobalLiquidationHistoryItem {
  id: string;
  date: string;
  amount: number;
  balance_after: number;
  description: string;
  reference: string;
  created_at: string;
}

// Caja Menor Config types
export interface CajaMenorConfig {
  id: string;
  base_amount: number;
  auto_close_enabled: boolean;
  auto_close_time: string | null;
  last_auto_close_at: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface CajaMenorConfigUpdate {
  base_amount?: number;
  auto_close_enabled?: boolean;
  auto_close_time?: string | null;
}

export interface CajaMenorAutoCloseResult {
  success: boolean;
  message: string;
  excess_amount: number;
  amount_transferred: number;
  caja_menor_new_balance: number;
  caja_mayor_new_balance: number;
  base_amount: number;
}

// Inter-Account Transfer types
export interface AccountTransferCreate {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  reason: string;
  reference?: string;
}

export interface AccountTransferResponse {
  success: boolean;
  message: string;
  transfer_id: string;
  amount: number;
  from_account: { id: string; name: string; code: string; new_balance: number };
  to_account: { id: string; name: string; code: string; new_balance: number };
  reference: string;
  created_at: string;
}

export interface TransferHistoryItem {
  id: string;
  amount: number;
  from_account_name: string;
  from_account_code: string | null;
  to_account_name: string;
  to_account_code: string | null;
  description: string;
  reference: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface TransferHistoryResponse {
  items: TransferHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

export const getGlobalCashBalances = async (): Promise<GlobalCashBalancesResponse> => {
  const response = await apiClient.get<GlobalCashBalancesResponse>(`${BASE_URL}/cash-balances`);
  return response.data;
};

export const initializeGlobalAccounts = async (
  cajaInitialBalance: number = 0,
  bancoInitialBalance: number = 0
): Promise<{ message: string; accounts: Record<string, string> }> => {
  const response = await apiClient.post<{ message: string; accounts: Record<string, string> }>(
    `${BASE_URL}/initialize-accounts`,
    null,
    { params: { caja_initial_balance: cajaInitialBalance, banco_initial_balance: bancoInitialBalance } }
  );
  return response.data;
};

export const setGlobalAccountBalance = async (
  accountCode: string,
  newBalance: number,
  description?: string
): Promise<{
  message: string;
  account_id: string;
  account_name: string;
  old_balance: number;
  new_balance: number;
  adjustment: number;
}> => {
  const response = await apiClient.post<{
    message: string;
    account_id: string;
    account_name: string;
    old_balance: number;
    new_balance: number;
    adjustment: number;
  }>(
    `${BASE_URL}/set-balance`,
    null,
    { params: { account_code: accountCode, new_balance: newBalance, description: description || 'Ajuste de balance inicial' } }
  );
  return response.data;
};

// ============================================
// Daily Flow by Account (Cierre de Caja)
// ============================================

export interface CategoryBreakdownItem {
  income: number;
  expense: number;
  count: number;
}

export interface CategoryBreakdown {
  sales: CategoryBreakdownItem;
  orders: CategoryBreakdownItem;
  alterations: CategoryBreakdownItem;
  sale_changes: CategoryBreakdownItem;
  transfers: CategoryBreakdownItem;
  expenses: CategoryBreakdownItem;
  other: CategoryBreakdownItem;
}

export interface AccountDailyFlow {
  account_id: string;
  account_name: string;
  account_code: string;
  opening_balance: number;
  total_income: number;
  total_expenses: number;
  closing_balance: number;
  income_count: number;
  expense_count: number;
  net_flow: number;
  breakdown_by_category?: CategoryBreakdown;
}

export interface DailyFlowTotals {
  opening_balance: number;
  total_income: number;
  total_expenses: number;
  closing_balance: number;
  net_flow: number;
}

export interface DailyFlowResponse {
  date: string;
  accounts: AccountDailyFlow[];
  totals: DailyFlowTotals;
}

/**
 * Get daily flow for each balance account (for cash register closing)
 * Shows opening balance, income, expenses, and closing balance for each account
 */
export const getDailyAccountFlow = async (targetDate?: string): Promise<DailyFlowResponse> => {
  const response = await apiClient.get<DailyFlowResponse>(
    `${BASE_URL}/daily-flow`,
    { params: targetDate ? { target_date: targetDate } : {} }
  );
  return response.data;
};

// ============================================
// Global Caja Menor / Liquidation (uses first available school for now)
// ============================================

export const getGlobalCajaMenorSummary = async (schoolId: string): Promise<GlobalCajaMenorSummary> => {
  const response = await apiClient.get<GlobalCajaMenorSummary>(`/schools/${schoolId}/accounting/caja-menor/summary`);
  return response.data;
};

export const liquidateGlobalCajaMenor = async (
  schoolId: string,
  amount: number,
  notes?: string
): Promise<GlobalLiquidationResult> => {
  const response = await apiClient.post<GlobalLiquidationResult>(
    `/schools/${schoolId}/accounting/caja-menor/liquidate`,
    null,
    { params: { amount, notes } }
  );
  return response.data;
};

export const getGlobalLiquidationHistory = async (
  schoolId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<GlobalLiquidationHistoryItem[]> => {
  const response = await apiClient.get<GlobalLiquidationHistoryItem[]>(
    `/schools/${schoolId}/accounting/caja-menor/liquidation-history`,
    {
      params: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        limit: options?.limit || 50
      }
    }
  );
  return response.data;
};

// ============================================
// Caja Menor Configuration & Auto-Close
// ============================================

export const getCajaMenorConfig = async (): Promise<CajaMenorConfig> => {
  const response = await apiClient.get<CajaMenorConfig>(`${BASE_URL}/caja-menor/config`);
  return response.data;
};

export const updateCajaMenorConfig = async (data: CajaMenorConfigUpdate): Promise<CajaMenorConfig> => {
  const response = await apiClient.patch<CajaMenorConfig>(`${BASE_URL}/caja-menor/config`, data);
  return response.data;
};

export const autoCloseCajaMenor = async (): Promise<CajaMenorAutoCloseResult> => {
  const response = await apiClient.post<CajaMenorAutoCloseResult>(`${BASE_URL}/caja-menor/auto-close`);
  return response.data;
};

// ============================================
// Inter-Account Transfers
// ============================================

export const createAccountTransfer = async (data: AccountTransferCreate): Promise<AccountTransferResponse> => {
  const response = await apiClient.post<AccountTransferResponse>(`${BASE_URL}/transfers`, data);
  return response.data;
};

export const getTransferHistory = async (params?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<TransferHistoryResponse> => {
  const response = await apiClient.get<TransferHistoryResponse>(`${BASE_URL}/transfers`, {
    params: {
      start_date: params?.startDate,
      end_date: params?.endDate,
      limit: params?.limit || 50,
      offset: params?.offset || 0,
    },
  });
  return response.data;
};

// ============================================
// Global Balance Accounts
// ============================================

export const getGlobalBalanceAccounts = async (
  accountType?: AccountType,
  isActive?: boolean
): Promise<BalanceAccountListItem[]> => {
  const response = await apiClient.get<BalanceAccountListItem[]>(
    `${BASE_URL}/balance-accounts`,
    { params: { account_type: accountType, is_active: isActive } }
  );
  return response.data;
};

export const getGlobalBalanceAccount = async (accountId: string): Promise<BalanceAccount> => {
  const response = await apiClient.get<BalanceAccount>(
    `${BASE_URL}/balance-accounts/${accountId}`
  );
  return response.data;
};

export interface GlobalBalanceEntry {
  id: string;
  entry_date: string;
  amount: number;
  balance_after: number;
  description: string;
  reference: string | null;
  created_at: string;
}

export const getGlobalBalanceEntries = async (
  accountId: string,
  limit: number = 50
): Promise<GlobalBalanceEntry[]> => {
  const response = await apiClient.get<GlobalBalanceEntry[]>(
    `${BASE_URL}/balance-accounts/${accountId}/entries`,
    { params: { limit } }
  );
  return response.data;
};

// Unified Balance Entries (all global accounts)
export interface UnifiedBalanceEntry {
  id: string;
  entry_date: string;
  created_at: string;
  account_id: string;
  account_code: string;
  account_name: string;
  amount: number;
  balance_after: number;
  description: string;
  reference: string | null;
}

export interface UnifiedBalanceEntriesResponse {
  items: UnifiedBalanceEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface UnifiedBalanceEntriesParams {
  startDate?: string;
  endDate?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
}

export const getUnifiedBalanceEntries = async (
  params: UnifiedBalanceEntriesParams = {}
): Promise<UnifiedBalanceEntriesResponse> => {
  const { startDate, endDate, accountId, limit = 50, offset = 0 } = params;
  const response = await apiClient.get<UnifiedBalanceEntriesResponse>(
    `${BASE_URL}/balance-entries`,
    {
      params: {
        start_date: startDate,
        end_date: endDate,
        account_id: accountId,
        limit,
        offset
      }
    }
  );
  return response.data;
};

export interface GlobalBalanceAccountCreate {
  account_type: AccountType;
  name: string;
  description?: string | null;
  code?: string | null;
  balance?: number;
  original_value?: number | null;
  accumulated_depreciation?: number | null;
  useful_life_years?: number | null;
  interest_rate?: number | null;
  due_date?: string | null;
  creditor?: string | null;
}

export interface GlobalBalanceAccountResponse {
  id: string;
  school_id: string | null;
  account_type: AccountType;
  name: string;
  description: string | null;
  code: string | null;
  balance: number;
  original_value: number | null;
  accumulated_depreciation: number | null;
  useful_life_years: number | null;
  interest_rate: number | null;
  due_date: string | null;
  creditor: string | null;
  net_value: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GlobalBalanceAccountUpdate {
  name?: string;
  description?: string | null;
  code?: string | null;
  balance?: number;
  original_value?: number | null;
  accumulated_depreciation?: number | null;
  useful_life_years?: number | null;
  interest_rate?: number | null;
  due_date?: string | null;
  creditor?: string | null;
  is_active?: boolean;
}

export const createGlobalBalanceAccount = async (
  data: GlobalBalanceAccountCreate
): Promise<GlobalBalanceAccountResponse> => {
  const response = await apiClient.post<GlobalBalanceAccountResponse>(
    `${BASE_URL}/balance-accounts`,
    data
  );
  return response.data;
};

export const updateGlobalBalanceAccount = async (
  accountId: string,
  data: GlobalBalanceAccountUpdate
): Promise<GlobalBalanceAccountResponse> => {
  const response = await apiClient.patch<GlobalBalanceAccountResponse>(
    `${BASE_URL}/balance-accounts/${accountId}`,
    data
  );
  return response.data;
};

export const deleteGlobalBalanceAccount = async (accountId: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/balance-accounts/${accountId}`);
};

// ============================================
// Global Balance General Summary
// ============================================

export interface GlobalBalanceGeneralSummary {
  assets: {
    current: number;
    fixed: number;
    other: number;
    total: number;
  };
  liabilities: {
    current: number;
    long_term: number;
    other: number;
    total: number;
  };
  equity: {
    capital: number;
    retained: number;
    other: number;
    total: number;
  };
  net_worth: number;
  balanced: boolean;
}

export const getGlobalBalanceGeneralSummary = async (): Promise<GlobalBalanceGeneralSummary> => {
  const response = await apiClient.get<GlobalBalanceGeneralSummary>(`${BASE_URL}/balance-general/summary`);
  return response.data;
};

export interface GlobalAccountDetail {
  id: string;
  code: string;
  name: string;
  balance: number;
  net_value: number;
}

export interface GlobalBalanceGeneralDetailed {
  accounts_by_type: Record<string, GlobalAccountDetail[]>;
  summary: {
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    net_worth: number;
  };
}

export const getGlobalBalanceGeneralDetailed = async (): Promise<GlobalBalanceGeneralDetailed> => {
  const response = await apiClient.get<GlobalBalanceGeneralDetailed>(`${BASE_URL}/balance-general/detailed`);
  return response.data;
};

// ============================================
// Global Expenses (Gastos del Negocio)
// ============================================

export interface GetGlobalExpensesOptions {
  category?: ExpenseCategory;
  isPaid?: boolean;
  startDate?: string;  // ISO format YYYY-MM-DD
  endDate?: string;    // ISO format YYYY-MM-DD
  minAmount?: number;
  maxAmount?: number;
  paymentAccountId?: string;  // UUID
  skip?: number;
  limit?: number;
}

export const getGlobalExpenses = async (
  options?: GetGlobalExpensesOptions
): Promise<ExpenseListItem[]> => {
  const response = await apiClient.get<ExpenseListItem[]>(
    `${BASE_URL}/expenses`,
    {
      params: {
        category: options?.category,
        is_paid: options?.isPaid,
        start_date: options?.startDate,
        end_date: options?.endDate,
        min_amount: options?.minAmount,
        max_amount: options?.maxAmount,
        payment_account_id: options?.paymentAccountId,
        skip: options?.skip || 0,
        limit: options?.limit || 500
      }
    }
  );
  return response.data;
};

export const getPendingGlobalExpenses = async (): Promise<ExpenseListItem[]> => {
  const response = await apiClient.get<ExpenseListItem[]>(`${BASE_URL}/expenses/pending`);
  return response.data;
};

export const getGlobalExpense = async (expenseId: string): Promise<Expense> => {
  const response = await apiClient.get<Expense>(`${BASE_URL}/expenses/${expenseId}`);
  return response.data;
};

export const createGlobalExpense = async (data: Omit<ExpenseCreate, 'school_id'>): Promise<Expense> => {
  const response = await apiClient.post<Expense>(`${BASE_URL}/expenses`, data);
  return response.data;
};

export const updateGlobalExpense = async (
  expenseId: string,
  data: Partial<ExpenseCreate>
): Promise<Expense> => {
  const response = await apiClient.patch<Expense>(`${BASE_URL}/expenses/${expenseId}`, data);
  return response.data;
};

export const deleteGlobalExpense = async (expenseId: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/expenses/${expenseId}`);
};

export const payGlobalExpense = async (
  expenseId: string,
  payment: ExpensePayment
): Promise<Expense> => {
  const response = await apiClient.post<Expense>(`${BASE_URL}/expenses/${expenseId}/pay`, payment);
  return response.data;
};

// Check if expense can be paid (validates balance)
export interface CheckBalanceResponse {
  can_pay: boolean;
  source: string | null;
  source_balance: number;
  fallback_available: boolean;
  fallback_source: string | null;
  fallback_balance: number | null;
  message?: string;
}

export const checkExpenseBalance = async (
  amount: number,
  paymentMethod: AccPaymentMethod
): Promise<CheckBalanceResponse> => {
  const response = await apiClient.post<CheckBalanceResponse>(
    `${BASE_URL}/expenses/check-balance`,
    null,
    {
      params: {
        amount,
        payment_method: paymentMethod
      }
    }
  );
  return response.data;
};

// ============================================
// Global Accounts Payable (Cuentas por Pagar)
// ============================================

export const getGlobalPayables = async (
  options?: { isPaid?: boolean; isOverdue?: boolean; skip?: number; limit?: number }
): Promise<AccountsPayableListItem[]> => {
  const response = await apiClient.get<AccountsPayableListItem[]>(
    `${BASE_URL}/payables`,
    {
      params: {
        is_paid: options?.isPaid,
        is_overdue: options?.isOverdue,
        skip: options?.skip || 0,
        limit: options?.limit || 100
      }
    }
  );
  return response.data;
};

export const getPendingGlobalPayables = async (): Promise<AccountsPayableListItem[]> => {
  const response = await apiClient.get<AccountsPayableListItem[]>(`${BASE_URL}/payables/pending`);
  return response.data;
};

export const getGlobalPayable = async (payableId: string): Promise<AccountsPayable> => {
  const response = await apiClient.get<AccountsPayable>(`${BASE_URL}/payables/${payableId}`);
  return response.data;
};

export const createGlobalPayable = async (data: Omit<AccountsPayableCreate, 'school_id'>): Promise<AccountsPayable> => {
  const response = await apiClient.post<AccountsPayable>(`${BASE_URL}/payables`, data);
  return response.data;
};

export const payGlobalPayable = async (
  payableId: string,
  payment: AccountsPayablePayment
): Promise<AccountsPayable> => {
  const response = await apiClient.post<AccountsPayable>(`${BASE_URL}/payables/${payableId}/pay`, payment);
  return response.data;
};

// ============================================
// Global Accounts Receivable (Cuentas por Cobrar)
// ============================================

export interface AccountsReceivableCreate {
  amount: number;
  description: string;
  invoice_date: string;
  due_date?: string | null;
  notes?: string | null;
  client_id?: string | null;
  sale_id?: string | null;
  order_id?: string | null;
}

export interface AccountsReceivable {
  id: string;
  school_id: string | null;
  client_id: string | null;
  sale_id: string | null;
  order_id: string | null;
  amount: number;
  amount_paid: number;
  balance: number;
  description: string;
  invoice_date: string;
  due_date: string | null;
  is_paid: boolean;
  is_overdue: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountsReceivableListItem {
  id: string;
  client_id: string | null;
  client_name: string | null;
  amount: number;
  amount_paid: number;
  balance: number;
  description: string;
  invoice_date: string;
  due_date: string | null;
  is_paid: boolean;
  is_overdue: boolean;
}

export interface AccountsReceivablePayment {
  amount: number;
  payment_method: 'cash' | 'transfer' | 'card';
  notes?: string | null;
}

export const getGlobalReceivables = async (
  options?: { isPaid?: boolean; isOverdue?: boolean; skip?: number; limit?: number }
): Promise<AccountsReceivableListItem[]> => {
  const response = await apiClient.get<AccountsReceivableListItem[]>(
    `${BASE_URL}/receivables`,
    {
      params: {
        is_paid: options?.isPaid,
        is_overdue: options?.isOverdue,
        skip: options?.skip || 0,
        limit: options?.limit || 100
      }
    }
  );
  return response.data;
};

export const getPendingGlobalReceivables = async (): Promise<AccountsReceivableListItem[]> => {
  const response = await apiClient.get<AccountsReceivableListItem[]>(`${BASE_URL}/receivables/pending`);
  return response.data;
};

export const getGlobalReceivable = async (receivableId: string): Promise<AccountsReceivable> => {
  const response = await apiClient.get<AccountsReceivable>(`${BASE_URL}/receivables/${receivableId}`);
  return response.data;
};

export const createGlobalReceivable = async (data: AccountsReceivableCreate): Promise<AccountsReceivable> => {
  const response = await apiClient.post<AccountsReceivable>(`${BASE_URL}/receivables`, data);
  return response.data;
};

export const payGlobalReceivable = async (
  receivableId: string,
  payment: AccountsReceivablePayment
): Promise<AccountsReceivable> => {
  const response = await apiClient.post<AccountsReceivable>(`${BASE_URL}/receivables/${receivableId}/pay`, payment);
  return response.data;
};

// Receivables + Payables Summary (calculated from both lists)
export interface ReceivablesPayablesSummary {
  total_receivables: number;
  receivables_collected: number;
  receivables_pending: number;
  receivables_overdue: number;
  receivables_count: number;
  total_payables: number;
  payables_paid: number;
  payables_pending: number;
  payables_overdue: number;
  payables_count: number;
  net_position: number;
}

export const getReceivablesPayables = async (): Promise<ReceivablesPayablesSummary> => {
  // Fetch both lists and calculate summary
  const [receivables, payables] = await Promise.all([
    getGlobalReceivables({}),
    getGlobalPayables({})
  ]);

  const today = new Date();

  // Calculate receivables summary
  const receivablesCollected = receivables.filter(r => r.is_paid).reduce((sum, r) => sum + Number(r.amount), 0);
  const receivablesPending = receivables.filter(r => !r.is_paid).reduce((sum, r) => sum + Number(r.amount), 0);
  const receivablesOverdue = receivables.filter(r => !r.is_paid && r.due_date && new Date(r.due_date) < today)
    .reduce((sum, r) => sum + Number(r.amount), 0);

  // Calculate payables summary
  const payablesPaid = payables.filter(p => p.is_paid).reduce((sum, p) => sum + Number(p.amount), 0);
  const payablesPending = payables.filter(p => !p.is_paid).reduce((sum, p) => sum + Number(p.amount), 0);
  const payablesOverdue = payables.filter(p => !p.is_paid && p.due_date && new Date(p.due_date) < today)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    total_receivables: receivablesCollected + receivablesPending,
    receivables_collected: receivablesCollected,
    receivables_pending: receivablesPending,
    receivables_overdue: receivablesOverdue,
    receivables_count: receivables.length,
    total_payables: payablesPaid + payablesPending,
    payables_paid: payablesPaid,
    payables_pending: payablesPending,
    payables_overdue: payablesOverdue,
    payables_count: payables.length,
    net_position: receivablesPending - payablesPending
  };
};

// ============================================
// Global Patrimony Summary
// ============================================

export interface GlobalPatrimonySummary {
  assets: {
    cash_and_bank: {
      caja: number;
      banco: number;
      total_liquid: number;
      caja_menor: number;
      caja_mayor: number;
      nequi: number;
      banco_cuenta: number;
    };
    inventory: {
      total_units: number;
      total_value: number;
      products_with_cost: number;
      products_estimated: number;
      cost_margin_used: number;
      by_school?: Record<string, {
        units: number;
        value: number;
        with_cost: number;
        estimated: number;
      }>;
    };
    accounts_receivable: {
      total: number;
      count: number;
    };
    fixed_assets: {
      total_value: number;
      count: number;
      breakdown: Array<{
        id: string;
        name: string;
        net_value: number;
      }>;
    };
    current_assets: number;
    total: number;
  };
  liabilities: {
    accounts_payable: {
      total: number;
      count: number;
    };
    pending_expenses: {
      total: number;
      count: number;
    };
    debts: {
      short_term: number;
      long_term: number;
      total: number;
      breakdown: Array<{
        id: string;
        name: string;
        balance: number;
        is_long_term: boolean;
      }>;
    };
    total: number;
  };
  summary: {
    total_assets: number;
    total_liabilities: number;
    net_patrimony: number;
    is_positive: boolean;
  };
  generated_at: string;
}

export const getGlobalPatrimonySummary = async (): Promise<GlobalPatrimonySummary> => {
  const response = await apiClient.get<GlobalPatrimonySummary>(`${BASE_URL}/patrimony-summary`);
  return response.data;
};

// ============================================
// Global Transactions (for Reports)
// ============================================

export interface GlobalTransactionOptions {
  startDate?: string;
  endDate?: string;
  transactionType?: 'income' | 'expense';
  schoolId?: string;
  skip?: number;
  limit?: number;
}

export interface GlobalTransactionItem {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  payment_method: string;
  description: string;
  category: string | null;
  reference_code: string | null;
  transaction_date: string;
  created_at: string;
  school_id: string | null;
  school_name: string | null;
}

export const getGlobalTransactions = async (
  options?: GlobalTransactionOptions
): Promise<GlobalTransactionItem[]> => {
  const response = await apiClient.get<GlobalTransactionItem[]>(
    `${BASE_URL}/transactions`,
    {
      params: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        transaction_type: options?.transactionType,
        school_id: options?.schoolId,
        skip: options?.skip || 0,
        limit: options?.limit || 50
      }
    }
  );
  return response.data;
};

// ============================================
// Expense Summary by Category
// ============================================

export interface ExpenseCategorySummary {
  category: string;
  category_label: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  count: number;
  percentage: number;
}

export const getExpensesSummaryByCategory = async (
  options?: { startDate?: string; endDate?: string }
): Promise<ExpenseCategorySummary[]> => {
  const response = await apiClient.get<ExpenseCategorySummary[]>(
    `${BASE_URL}/expenses/summary-by-category`,
    {
      params: {
        start_date: options?.startDate,
        end_date: options?.endDate
      }
    }
  );
  return response.data;
};

// ============================================
// Expense Adjustments (Rollbacks/Corrections)
// ============================================

export type AdjustmentReason =
  | 'amount_correction'
  | 'account_correction'
  | 'both_correction'
  | 'error_reversal'
  | 'partial_refund';

export interface ExpenseAdjustmentRequest {
  new_amount?: number;
  new_payment_account_id?: string;
  new_payment_method?: string;
  reason?: AdjustmentReason;
  description: string;
}

export interface ExpenseAdjustmentResponse {
  id: string;
  expense_id: string;
  reason: AdjustmentReason;
  description: string;
  previous_amount: number;
  previous_amount_paid: number;
  previous_payment_method: string | null;
  previous_payment_account_id: string | null;
  new_amount: number;
  new_amount_paid: number;
  new_payment_method: string | null;
  new_payment_account_id: string | null;
  adjustment_delta: number;
  refund_entry_id: string | null;
  new_payment_entry_id: string | null;
  adjusted_by: string | null;
  adjusted_by_username?: string;
  adjusted_at: string;
}

export interface RevertExpenseRequest {
  description: string;
}

export interface PartialRefundRequest {
  refund_amount: number;
  description: string;
}

export interface AdjustmentListParams {
  start_date?: string;
  end_date?: string;
  reason?: AdjustmentReason;
  skip?: number;
  limit?: number;
}

/**
 * Adjust an expense (change amount and/or payment account)
 */
export const adjustExpense = async (
  expenseId: string,
  data: ExpenseAdjustmentRequest
): Promise<ExpenseAdjustmentResponse> => {
  const response = await apiClient.post<ExpenseAdjustmentResponse>(
    `${BASE_URL}/expenses/${expenseId}/adjust`,
    data
  );
  return response.data;
};

/**
 * Revert an expense payment completely
 */
export const revertExpensePayment = async (
  expenseId: string,
  description: string
): Promise<ExpenseAdjustmentResponse> => {
  const response = await apiClient.post<ExpenseAdjustmentResponse>(
    `${BASE_URL}/expenses/${expenseId}/revert`,
    { description }
  );
  return response.data;
};

/**
 * Partial refund on an expense
 */
export const partialRefundExpense = async (
  expenseId: string,
  refundAmount: number,
  description: string
): Promise<ExpenseAdjustmentResponse> => {
  const response = await apiClient.post<ExpenseAdjustmentResponse>(
    `${BASE_URL}/expenses/${expenseId}/partial-refund`,
    { refund_amount: refundAmount, description }
  );
  return response.data;
};

/**
 * Get adjustment history for a specific expense
 */
export const getExpenseAdjustments = async (
  expenseId: string
): Promise<ExpenseAdjustmentResponse[]> => {
  const response = await apiClient.get<ExpenseAdjustmentResponse[]>(
    `${BASE_URL}/expenses/${expenseId}/adjustments`
  );
  return response.data;
};

/**
 * List all adjustments with optional filters
 */
export const listAdjustments = async (
  params?: AdjustmentListParams
): Promise<ExpenseAdjustmentResponse[]> => {
  const response = await apiClient.get<ExpenseAdjustmentResponse[]>(
    `${BASE_URL}/adjustments`,
    {
      params: {
        start_date: params?.start_date,
        end_date: params?.end_date,
        reason: params?.reason,
        skip: params?.skip || 0,
        limit: params?.limit || 50
      }
    }
  );
  return response.data;
};

/**
 * Get human-readable label for adjustment reason
 */
export const getAdjustmentReasonLabel = (reason: AdjustmentReason): string => {
  const labels: Record<AdjustmentReason, string> = {
    amount_correction: 'Corrección de Monto',
    account_correction: 'Cambio de Cuenta',
    both_correction: 'Corrección de Monto y Cuenta',
    error_reversal: 'Reversión por Error',
    partial_refund: 'Reembolso Parcial'
  };
  return labels[reason] || reason;
};

/**
 * Get color class for adjustment reason
 */
export const getAdjustmentReasonColor = (reason: AdjustmentReason): string => {
  const colors: Record<AdjustmentReason, string> = {
    amount_correction: 'bg-blue-100 text-blue-800',
    account_correction: 'bg-purple-100 text-purple-800',
    both_correction: 'bg-indigo-100 text-indigo-800',
    error_reversal: 'bg-red-100 text-red-800',
    partial_refund: 'bg-amber-100 text-amber-800'
  };
  return colors[reason] || 'bg-gray-100 text-gray-800';
};

// ============================================
// Cash Flow Report
// ============================================

export interface CashFlowPeriod {
  period: string;
  period_label: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CashFlowReport {
  period_start: string;
  period_end: string;
  group_by: string;
  total_income: number;
  total_expenses: number;
  net_flow: number;
  periods: CashFlowPeriod[];
}

export const getCashFlowReport = async (
  startDate: string,
  endDate: string,
  groupBy: string = 'day'
): Promise<CashFlowReport> => {
  const response = await apiClient.get<CashFlowReport>(
    `${BASE_URL}/cash-flow`,
    {
      params: {
        start_date: startDate,
        end_date: endDate,
        group_by: groupBy
      }
    }
  );
  return response.data;
};

// ============================================
// Financial Planning
// ============================================

/**
 * Get the planning dashboard data
 */
export const getPlanningDashboard = async (): Promise<PlanningDashboard> => {
  const response = await apiClient.get<PlanningDashboard>(`${BASE_URL}/planning/dashboard`);
  return response.data;
};

/**
 * Get sales seasonality analysis
 */
export const getSalesSeasonality = async (
  startYear?: number,
  endYear?: number
): Promise<SalesSeasonalityResponse> => {
  const response = await apiClient.get<SalesSeasonalityResponse>(
    `${BASE_URL}/planning/sales-seasonality`,
    {
      params: {
        start_year: startYear,
        end_year: endYear
      }
    }
  );
  return response.data;
};

/**
 * Get cash flow projection
 */
export const getCashProjection = async (
  params?: CashProjectionParams
): Promise<CashProjectionResponse> => {
  const response = await apiClient.get<CashProjectionResponse>(
    `${BASE_URL}/planning/cash-projection`,
    {
      params: {
        months: params?.months || 6,
        growth_factor: params?.growth_factor || 1.20,
        liquidity_threshold: params?.liquidity_threshold || 5000000
      }
    }
  );
  return response.data;
};

/**
 * List debt payments
 */
export const getDebtPayments = async (
  options?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<DebtPaymentListResponse> => {
  const response = await apiClient.get<DebtPaymentListResponse>(
    `${BASE_URL}/planning/debt-schedule`,
    {
      params: {
        status: options?.status,
        start_date: options?.startDate,
        end_date: options?.endDate,
        limit: options?.limit || 100,
        offset: options?.offset || 0
      }
    }
  );
  return response.data;
};

/**
 * Create a new debt payment schedule
 */
export const createDebtPayment = async (
  data: DebtPaymentCreate
): Promise<{ message: string; payment_id: string; description: string; amount: number; due_date: string }> => {
  const response = await apiClient.post<{ message: string; payment_id: string; description: string; amount: number; due_date: string }>(
    `${BASE_URL}/planning/debt-schedule`,
    data
  );
  return response.data;
};

/**
 * Update a debt payment
 */
export const updateDebtPayment = async (
  paymentId: string,
  data: Partial<DebtPaymentCreate> & { status?: string }
): Promise<{ message: string; payment_id: string }> => {
  const response = await apiClient.patch<{ message: string; payment_id: string }>(
    `${BASE_URL}/planning/debt-schedule/${paymentId}`,
    data
  );
  return response.data;
};

/**
 * Mark a debt payment as paid
 */
export const markDebtPaymentAsPaid = async (
  paymentId: string,
  paidDate: string,
  paidAmount: number,
  paymentMethod: string,
  paymentAccountId: string
): Promise<{ message: string; payment_id: string; paid_date: string; paid_amount: number }> => {
  const response = await apiClient.post<{ message: string; payment_id: string; paid_date: string; paid_amount: number }>(
    `${BASE_URL}/planning/debt-schedule/${paymentId}/mark-paid`,
    {
      paid_date: paidDate,
      paid_amount: paidAmount,
      payment_method: paymentMethod,
      payment_account_id: paymentAccountId
    }
  );
  return response.data;
};

/**
 * Delete a debt payment (only pending)
 */
export const deleteDebtPayment = async (paymentId: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/planning/debt-schedule/${paymentId}`);
};

/**
 * Update overdue payments status
 */
export const updateOverduePayments = async (): Promise<{ message: string; updated_count: number }> => {
  const response = await apiClient.post<{ message: string; updated_count: number }>(`${BASE_URL}/planning/update-overdue`);
  return response.data;
};

export interface ImportLiabilitiesResponse {
  message: string;
  imported: Array<{
    name: string;
    capital: number;
    interest_rate: number | null;
    due_date: string;
    payments_generated: number;
    payments: Array<{
      type: 'interest' | 'capital';
      amount: number;
      due_date: string;
    }>;
  }>;
  skipped: Array<{
    name: string;
    reason: string;
  }>;
  total_imported: number;
  total_skipped: number;
  total_payments_generated: number;
}

/**
 * Import liability accounts (LIABILITY_LONG) into debt payment schedule.
 * Generates monthly interest payments + capital payment at due_date.
 */
export const importLiabilitiesToDebtSchedule = async (): Promise<ImportLiabilitiesResponse> => {
  const response = await apiClient.post<ImportLiabilitiesResponse>(`${BASE_URL}/planning/import-liabilities`);
  return response.data;
};

export interface GeneratePendingInterestResponse {
  message: string;
  generated: Array<{
    liability_name: string;
    description: string;
    amount: number;
    due_date: string;
  }>;
  total_generated: number;
}

/**
 * Generate missing interest payments for all active liabilities.
 * Use when due dates have been extended or debts remain unpaid.
 */
export const generatePendingInterest = async (): Promise<GeneratePendingInterestResponse> => {
  const response = await apiClient.post<GeneratePendingInterestResponse>(`${BASE_URL}/planning/generate-pending-interest`);
  return response.data;
};

// ============================================
// Financial Statements (Estados Financieros)
// ============================================

export interface COGSDetails {
  total: number;
  from_actual_cost: number;
  from_estimated_cost: number;
  items_with_actual_cost: number;
  items_with_estimated_cost: number;
  estimation_margin_used: number;
}

export interface OperatingExpensesBreakdown {
  rent: number;
  utilities: number;
  payroll: number;
  supplies: number;
  transport: number;
  maintenance: number;
  marketing: number;
  total: number;
}

export interface OtherExpensesBreakdown {
  taxes: number;
  bank_fees: number;
  other: number;
  total: number;
}

export interface ExpenseCategoryTotal {
  category: string;
  category_label: string;
  total: number;
  percentage_of_revenue: number;
}

export interface PeriodComparison {
  revenue_change_percent: number | null;
  gross_profit_change_percent: number | null;
  operating_income_change_percent: number | null;
  net_income_change_percent: number | null;
}

export interface ReturnsDiscountsBreakdown {
  discounts: number;
  discounts_count: number;
  sale_returns: number;
  sale_returns_count: number;
}

export interface OtherExpenseDetail {
  id: string;
  description: string;
  amount: number;
  date: string;
  vendor: string;
}

export interface IncomeStatementResponse {
  period_start: string;
  period_end: string;
  // Revenue
  gross_revenue: number;
  returns_discounts: number;
  returns_discounts_breakdown?: ReturnsDiscountsBreakdown;
  net_revenue: number;
  sales_count: number;
  revenue_breakdown: {
    by_school: Array<{
      school_id: string;
      school_name: string;
      total: number;
      count: number;
    }>;
    global_products: {
      total: number;
      count: number;
    };
  };
  // COGS
  cost_of_goods_sold: number;
  cogs_details: COGSDetails;
  // Gross Profit
  gross_profit: number;
  gross_margin_percent: number;
  // Operating Expenses
  operating_expenses: OperatingExpensesBreakdown;
  operating_expenses_by_category: ExpenseCategoryTotal[];
  total_operating_expenses: number;
  // Operating Income
  operating_income: number;
  operating_margin_percent: number;
  // Other Expenses
  other_expenses: OtherExpensesBreakdown;
  other_expenses_by_category: ExpenseCategoryTotal[];
  other_expenses_details?: OtherExpenseDetail[];
  financial_expenses: number;
  // Net Income
  net_income: number;
  net_margin_percent: number;
  // Data Quality
  cogs_coverage_percent: number;
  disclaimer: string | null;
  // Comparison
  previous_period: IncomeStatementResponse | null;
  period_comparison: PeriodComparison | null;
}

export interface CashAccountDetail {
  id: string;
  name: string;
  code: string;
  balance: number;
}

export interface InventoryDetail {
  total_value: number;
  total_units: number;
  from_actual_cost: number;
  from_estimated_cost: number;
  coverage_percent: number;
}

export interface AccountDetail {
  id: string;
  name: string;
  code: string | null;
  balance: number;
  net_value: number;
}

export interface CurrentAssetsDetail {
  cash_accounts: CashAccountDetail[];
  total_cash: number;
  accounts_receivable: number;
  accounts_receivable_count: number;
  inventory: InventoryDetail;
  total_inventory: number;
  other_current: AccountDetail[];
  total_other_current: number;
}

export interface CurrentLiabilitiesDetail {
  accounts_payable: number;
  accounts_payable_count: number;
  pending_expenses: number;
  pending_expenses_count: number;
  short_term_debt: AccountDetail[];
  total_short_term_debt: number;
  other_current: AccountDetail[];
  total_other_current: number;
}

export interface EquityDetail {
  capital: number;
  retained_earnings: number;
  current_period_earnings: number;
  other_equity: number;
  accounts: AccountDetail[];
}

export interface BalanceSheetResponse {
  as_of_date: string;
  // Current Assets
  current_assets: CurrentAssetsDetail;
  total_current_assets: number;
  // Fixed Assets
  fixed_assets: AccountDetail[];
  total_fixed_assets: number;
  // Other Assets
  other_assets: AccountDetail[];
  total_other_assets: number;
  total_assets: number;
  // Current Liabilities
  current_liabilities: CurrentLiabilitiesDetail;
  total_current_liabilities: number;
  // Long-term Liabilities
  long_term_liabilities: AccountDetail[];
  total_long_term_liabilities: number;
  // Other Liabilities
  other_liabilities: AccountDetail[];
  total_other_liabilities: number;
  total_liabilities: number;
  // Equity
  equity: EquityDetail;
  total_equity: number;
  // Validation
  is_balanced: boolean;
  balance_difference: number;
  net_worth: number;
  // Data quality
  inventory_coverage_percent: number;
  disclaimer: string | null;
  historical_note: string | null;
}

export interface PeriodPreset {
  key: string;
  label: string;
  start_date: string;
  end_date: string;
}

export interface AvailablePeriodsResponse {
  presets: PeriodPreset[];
  earliest_data_date: string | null;
}

export interface FinancialSnapshotItem {
  id: string;
  snapshot_type: 'balance_sheet' | 'income_statement';
  snapshot_date: string;
  period_start: string | null;
  period_end: string | null;
  notes: string | null;
  created_at: string;
}

export interface FinancialSnapshotFull extends FinancialSnapshotItem {
  data: Record<string, unknown>;
}

/**
 * Get Income Statement (Estado de Resultados) for a period
 */
export const getIncomeStatement = async (
  startDate: string,
  endDate: string,
  comparePrevious: boolean = false
): Promise<IncomeStatementResponse> => {
  const response = await apiClient.get<IncomeStatementResponse>(
    `${BASE_URL}/financial-statements/income-statement`,
    { params: { start_date: startDate, end_date: endDate, compare_previous: comparePrevious } }
  );
  return response.data;
};

/**
 * Get Balance Sheet (Balance General) as of a date
 */
export const getBalanceSheet = async (
  asOfDate?: string
): Promise<BalanceSheetResponse> => {
  const response = await apiClient.get<BalanceSheetResponse>(
    `${BASE_URL}/financial-statements/balance-sheet`,
    { params: asOfDate ? { as_of_date: asOfDate } : {} }
  );
  return response.data;
};

/**
 * Get available period presets for financial statements
 */
export const getAvailablePeriods = async (): Promise<AvailablePeriodsResponse> => {
  const response = await apiClient.get<AvailablePeriodsResponse>(
    `${BASE_URL}/financial-statements/periods`
  );
  return response.data;
};

// ============================================
// Expense Categories Management
// ============================================

export interface ExpenseCategoryListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  is_system: boolean;
  is_active: boolean;
  display_order: number;
}

export interface ExpenseCategoryFull extends ExpenseCategoryListItem {
  created_at: string;
  updated_at: string;
}

export interface ExpenseCategoryCreate {
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
}

export interface ExpenseCategoryUpdate {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
  is_active?: boolean;
}

/**
 * Get all expense categories
 */
export const getExpenseCategories = async (
  includeInactive: boolean = false,
  limit: number = 100,
  offset: number = 0
): Promise<ExpenseCategoryListItem[]> => {
  const response = await apiClient.get<ExpenseCategoryListItem[]>(
    `${BASE_URL}/expense-categories`,
    { params: { include_inactive: includeInactive, limit, offset } }
  );
  return response.data;
};

/**
 * Get a single expense category by ID
 */
export const getExpenseCategory = async (categoryId: string): Promise<ExpenseCategoryFull> => {
  const response = await apiClient.get<ExpenseCategoryFull>(
    `${BASE_URL}/expense-categories/${categoryId}`
  );
  return response.data;
};

/**
 * Create a new expense category
 */
export const createExpenseCategory = async (
  data: ExpenseCategoryCreate
): Promise<ExpenseCategoryFull> => {
  const response = await apiClient.post<ExpenseCategoryFull>(
    `${BASE_URL}/expense-categories`,
    data
  );
  return response.data;
};

/**
 * Update an expense category
 */
export const updateExpenseCategory = async (
  categoryId: string,
  data: ExpenseCategoryUpdate
): Promise<ExpenseCategoryFull> => {
  const response = await apiClient.patch<ExpenseCategoryFull>(
    `${BASE_URL}/expense-categories/${categoryId}`,
    data
  );
  return response.data;
};

/**
 * Delete (soft-delete) an expense category
 */
export const deleteExpenseCategory = async (categoryId: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/expense-categories/${categoryId}`);
};

/**
 * Permanent delete for inactive expense categories
 */
export const permanentDeleteExpenseCategory = async (categoryId: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/expense-categories/${categoryId}/permanent`);
};

// ============================================
// Financial Snapshots
// ============================================

export const createFinancialSnapshot = async (params: {
  snapshot_type: string;
  snapshot_date: string;
  period_start?: string;
  period_end?: string;
  notes?: string;
}): Promise<FinancialSnapshotItem> => {
  const searchParams = new URLSearchParams();
  searchParams.set('snapshot_type', params.snapshot_type);
  searchParams.set('snapshot_date', params.snapshot_date);
  if (params.period_start) searchParams.set('period_start', params.period_start);
  if (params.period_end) searchParams.set('period_end', params.period_end);
  if (params.notes) searchParams.set('notes', params.notes);
  const response = await apiClient.post<FinancialSnapshotItem>(
    `${BASE_URL}/financial-snapshots?${searchParams.toString()}`
  );
  return response.data;
};

export const listFinancialSnapshots = async (
  snapshotType?: string,
  limit: number = 50
): Promise<FinancialSnapshotItem[]> => {
  const params = new URLSearchParams();
  if (snapshotType) params.set('snapshot_type', snapshotType);
  params.set('limit', String(limit));
  const response = await apiClient.get<FinancialSnapshotItem[]>(
    `${BASE_URL}/financial-snapshots?${params.toString()}`
  );
  return response.data;
};

export const getFinancialSnapshot = async (snapshotId: string): Promise<FinancialSnapshotFull> => {
  const response = await apiClient.get<FinancialSnapshotFull>(
    `${BASE_URL}/financial-snapshots/${snapshotId}`
  );
  return response.data;
};

export const deleteFinancialSnapshot = async (snapshotId: string): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/financial-snapshots/${snapshotId}`);
};

// ============================================
// Export as object for easier imports
// ============================================

export const globalAccountingService = {
  // Cash Balances
  getGlobalCashBalances,
  getCashBalances: getGlobalCashBalances, // Alias for backwards compatibility
  initializeGlobalAccounts,
  setGlobalAccountBalance,
  // Daily Flow (Cierre de Caja)
  getDailyAccountFlow,
  getDailyFlow: getDailyAccountFlow, // Alias for backwards compatibility
  // Caja Menor / Liquidation
  getGlobalCajaMenorSummary,
  liquidateGlobalCajaMenor,
  getGlobalLiquidationHistory,
  // Caja Menor Config & Auto-Close
  getCajaMenorConfig,
  updateCajaMenorConfig,
  autoCloseCajaMenor,
  // Inter-Account Transfers
  createAccountTransfer,
  getTransferHistory,
  // Balance Accounts
  getGlobalBalanceAccounts,
  getBalanceAccounts: getGlobalBalanceAccounts, // Alias
  getGlobalBalanceAccount,
  getGlobalBalanceEntries,
  createGlobalBalanceAccount,
  createBalanceAccount: createGlobalBalanceAccount, // Alias
  updateGlobalBalanceAccount,
  updateBalanceAccount: updateGlobalBalanceAccount, // Alias
  deleteGlobalBalanceAccount,
  deleteBalanceAccount: deleteGlobalBalanceAccount, // Alias
  // Balance General
  getGlobalBalanceGeneralSummary,
  getGlobalBalanceGeneralDetailed,
  // Expenses
  getGlobalExpenses,
  getPendingGlobalExpenses,
  getGlobalExpense,
  createGlobalExpense,
  updateGlobalExpense,
  deleteGlobalExpense,
  payGlobalExpense,
  checkExpenseBalance,
  // Expense Adjustments
  adjustExpense,
  revertExpensePayment,
  partialRefundExpense,
  getExpenseAdjustments,
  listAdjustments,
  getAdjustmentReasonLabel,
  getAdjustmentReasonColor,
  // Payables
  getGlobalPayables,
  getPayables: getGlobalPayables, // Alias
  getPendingGlobalPayables,
  getGlobalPayable,
  createGlobalPayable,
  createPayable: createGlobalPayable, // Alias
  payGlobalPayable,
  payPayable: payGlobalPayable, // Alias
  // Receivables
  getGlobalReceivables,
  getReceivables: getGlobalReceivables, // Alias
  getPendingGlobalReceivables,
  getGlobalReceivable,
  createGlobalReceivable,
  createReceivable: createGlobalReceivable, // Alias
  payGlobalReceivable,
  payReceivable: payGlobalReceivable, // Alias
  // Receivables + Payables Summary
  getReceivablesPayables,
  // Patrimony
  getGlobalPatrimonySummary,
  getPatrimonySummary: getGlobalPatrimonySummary, // Alias
  // Transactions & Reports
  getGlobalTransactions,
  getExpensesSummaryByCategory,
  getCashFlowReport,
  // Unified Balance Entries (Log)
  getUnifiedBalanceEntries,
  // Financial Planning
  getPlanningDashboard,
  getSalesSeasonality,
  getCashProjection,
  getDebtPayments,
  createDebtPayment,
  updateDebtPayment,
  markDebtPaymentAsPaid,
  deleteDebtPayment,
  updateOverduePayments,
  importLiabilitiesToDebtSchedule,
  generatePendingInterest,
  // Financial Statements
  getIncomeStatement,
  getBalanceSheet,
  getAvailablePeriods,
  // Expense Categories
  getExpenseCategories,
  getExpenseCategory,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  permanentDeleteExpenseCategory,
  // Financial Snapshots
  createFinancialSnapshot,
  listFinancialSnapshots,
  getFinancialSnapshot,
  deleteFinancialSnapshot
};

export default globalAccountingService;
