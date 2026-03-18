/**
 * Accounting Service - API calls for accounting, transactions, and expenses
 */
import apiClient from '../utils/api-client';
import type {
  AccountingDashboard,
  TransactionListItem,
  TransactionCreate,
  Transaction,
  ExpenseListItem,
  ExpenseCreate,
  Expense,
  ExpensePayment,
  DailyCashRegister,
  CashFlowSummary,
  ExpensesByCategory,
  TransactionType,
  ExpenseCategory,
  // Balance General types
  BalanceGeneralSummary,
  BalanceGeneralDetailed,
  ReceivablesPayablesSummary,
  BalanceAccount,
  BalanceAccountCreate,
  BalanceAccountUpdate,
  BalanceAccountListItem,
  BalanceEntry,
  BalanceEntryCreate,
  AccountsReceivable,
  AccountsReceivableCreate,
  AccountsReceivablePayment,
  AccountsReceivableListItem,
  AccountsPayable,
  AccountsPayableCreate,
  AccountsPayablePayment,
  AccountsPayableListItem,
  AccountType
} from '../types/api';

// Re-export types for components that import from this service
export type { ExpenseCategory, AccPaymentMethod } from '../types/api';

const BASE_URL = '/schools';

// Dashboard
export async function getAccountingDashboard(schoolId: string): Promise<AccountingDashboard> {
  const response = await apiClient.get<AccountingDashboard>(
    `${BASE_URL}/${schoolId}/accounting/dashboard`
  );
  return response.data;
}

// Cash Flow
export async function getCashFlowSummary(
  schoolId: string,
  startDate: string,
  endDate: string
): Promise<CashFlowSummary> {
  const response = await apiClient.get<CashFlowSummary>(
    `${BASE_URL}/${schoolId}/accounting/cash-flow`,
    { params: { start_date: startDate, end_date: endDate } }
  );
  return response.data;
}

// Transactions
export async function getTransactions(
  schoolId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    type?: TransactionType;
    skip?: number;
    limit?: number;
  }
): Promise<TransactionListItem[]> {
  const response = await apiClient.get<TransactionListItem[]>(
    `${BASE_URL}/${schoolId}/accounting/transactions`,
    {
      params: {
        start_date: options?.startDate,
        end_date: options?.endDate,
        transaction_type: options?.type,
        skip: options?.skip || 0,
        limit: options?.limit || 100
      }
    }
  );
  return response.data;
}

export async function getTransaction(schoolId: string, transactionId: string): Promise<Transaction> {
  const response = await apiClient.get<Transaction>(
    `${BASE_URL}/${schoolId}/accounting/transactions/${transactionId}`
  );
  return response.data;
}

export async function createTransaction(schoolId: string, data: Omit<TransactionCreate, 'school_id'>): Promise<Transaction> {
  const response = await apiClient.post<Transaction>(
    `${BASE_URL}/${schoolId}/accounting/transactions`,
    { ...data, school_id: schoolId }
  );
  return response.data;
}

// Expenses
export async function getExpenses(
  schoolId: string,
  options?: {
    category?: ExpenseCategory;
    isPaid?: boolean;
    skip?: number;
    limit?: number;
  }
): Promise<ExpenseListItem[]> {
  const response = await apiClient.get<ExpenseListItem[]>(
    `${BASE_URL}/${schoolId}/accounting/expenses`,
    {
      params: {
        category: options?.category,
        is_paid: options?.isPaid,
        skip: options?.skip || 0,
        limit: options?.limit || 100
      }
    }
  );
  return response.data;
}

export async function getPendingExpenses(schoolId: string): Promise<ExpenseListItem[]> {
  const response = await apiClient.get<ExpenseListItem[]>(
    `${BASE_URL}/${schoolId}/accounting/expenses/pending`
  );
  return response.data;
}

export async function getExpensesByCategory(
  schoolId: string,
  startDate: string,
  endDate: string
): Promise<ExpensesByCategory[]> {
  const response = await apiClient.get<ExpensesByCategory[]>(
    `${BASE_URL}/${schoolId}/accounting/expenses/by-category`,
    { params: { start_date: startDate, end_date: endDate } }
  );
  return response.data;
}

export async function getExpense(schoolId: string, expenseId: string): Promise<Expense> {
  const response = await apiClient.get<Expense>(
    `${BASE_URL}/${schoolId}/accounting/expenses/${expenseId}`
  );
  return response.data;
}

export async function createExpense(schoolId: string, data: Omit<ExpenseCreate, 'school_id'>): Promise<Expense> {
  const response = await apiClient.post<Expense>(
    `${BASE_URL}/${schoolId}/accounting/expenses`,
    { ...data, school_id: schoolId }
  );
  return response.data;
}

export async function updateExpense(
  schoolId: string,
  expenseId: string,
  data: Partial<ExpenseCreate>
): Promise<Expense> {
  const response = await apiClient.patch<Expense>(
    `${BASE_URL}/${schoolId}/accounting/expenses/${expenseId}`,
    data
  );
  return response.data;
}

export async function payExpense(
  schoolId: string,
  expenseId: string,
  payment: ExpensePayment
): Promise<Expense> {
  const response = await apiClient.post<Expense>(
    `${BASE_URL}/${schoolId}/accounting/expenses/${expenseId}/pay`,
    payment
  );
  return response.data;
}

export async function deleteExpense(schoolId: string, expenseId: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${schoolId}/accounting/expenses/${expenseId}`);
}

// Daily Cash Register
export async function getTodayRegister(schoolId: string): Promise<DailyCashRegister> {
  const response = await apiClient.get<DailyCashRegister>(
    `${BASE_URL}/${schoolId}/accounting/cash-register/today`
  );
  return response.data;
}

export async function getRegisterByDate(schoolId: string, date: string): Promise<DailyCashRegister> {
  const response = await apiClient.get<DailyCashRegister>(
    `${BASE_URL}/${schoolId}/accounting/cash-register/${date}`
  );
  return response.data;
}

export async function openCashRegister(
  schoolId: string,
  registerDate: string,
  openingBalance: number
): Promise<DailyCashRegister> {
  const response = await apiClient.post<DailyCashRegister>(
    `${BASE_URL}/${schoolId}/accounting/cash-register`,
    { school_id: schoolId, register_date: registerDate, opening_balance: openingBalance }
  );
  return response.data;
}

export async function closeCashRegister(
  schoolId: string,
  registerId: string,
  closingBalance: number,
  notes?: string
): Promise<DailyCashRegister> {
  const response = await apiClient.post<DailyCashRegister>(
    `${BASE_URL}/${schoolId}/accounting/cash-register/${registerId}/close`,
    { closing_balance: closingBalance, notes }
  );
  return response.data;
}

/**
 * @deprecated Use useExpenseCategories hook instead for dynamic categories.
 * Example: const { getCategoryLabel } = useExpenseCategories();
 * This function only knows about system categories - custom categories won't be labeled.
 */
export function getExpenseCategoryLabel(category: ExpenseCategory): string {
  const labels: Record<ExpenseCategory, string> = {
    rent: 'Arriendo',
    utilities: 'Servicios Públicos',
    payroll: 'Nómina',
    supplies: 'Insumos',
    inventory: 'Inventario',
    transport: 'Transporte',
    maintenance: 'Mantenimiento',
    marketing: 'Marketing',
    taxes: 'Impuestos',
    bank_fees: 'Comisiones Bancarias',
    other: 'Otros'
  };
  return labels[category] || category;
}

/**
 * @deprecated Use useExpenseCategories hook instead for dynamic categories.
 * Example: const { getCategoryColor } = useExpenseCategories();
 * This function only knows about system categories - custom categories won't be colored.
 */
export function getExpenseCategoryColor(category: ExpenseCategory): string {
  const colors: Record<ExpenseCategory, string> = {
    rent: 'bg-purple-100 text-purple-800',
    utilities: 'bg-blue-100 text-blue-800',
    payroll: 'bg-green-100 text-green-800',
    supplies: 'bg-yellow-100 text-yellow-800',
    inventory: 'bg-orange-100 text-orange-800',
    transport: 'bg-cyan-100 text-cyan-800',
    maintenance: 'bg-red-100 text-red-800',
    marketing: 'bg-pink-100 text-pink-800',
    taxes: 'bg-gray-100 text-gray-800',
    bank_fees: 'bg-indigo-100 text-indigo-800',
    other: 'bg-slate-100 text-slate-800'
  };
  return colors[category] || 'bg-gray-100 text-gray-800';
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    nequi: 'Nequi',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    credit: 'Crédito',
    other: 'Otro'
  };
  return labels[method] || method;
}

// ============================================
// Balance General (Balance Sheet)
// ============================================

export async function getBalanceGeneralSummary(schoolId: string): Promise<BalanceGeneralSummary> {
  const response = await apiClient.get<BalanceGeneralSummary>(
    `${BASE_URL}/${schoolId}/accounting/balance-general/summary`
  );
  return response.data;
}

export async function getBalanceGeneralDetailed(schoolId: string): Promise<BalanceGeneralDetailed> {
  const response = await apiClient.get<BalanceGeneralDetailed>(
    `${BASE_URL}/${schoolId}/accounting/balance-general/detailed`
  );
  return response.data;
}

export async function getReceivablesPayablesSummary(schoolId: string): Promise<ReceivablesPayablesSummary> {
  const response = await apiClient.get<ReceivablesPayablesSummary>(
    `${BASE_URL}/${schoolId}/accounting/receivables-payables/summary`
  );
  return response.data;
}

// Balance Accounts (Cuentas de Balance)
export async function getBalanceAccounts(
  schoolId: string,
  accountType?: AccountType,
  isActive?: boolean
): Promise<BalanceAccountListItem[]> {
  const response = await apiClient.get<BalanceAccountListItem[]>(
    `${BASE_URL}/${schoolId}/accounting/balance-accounts`,
    { params: { account_type: accountType, is_active: isActive } }
  );
  return response.data;
}

export async function getBalanceAccount(schoolId: string, accountId: string): Promise<BalanceAccount> {
  const response = await apiClient.get<BalanceAccount>(
    `${BASE_URL}/${schoolId}/accounting/balance-accounts/${accountId}`
  );
  return response.data;
}

export async function createBalanceAccount(
  schoolId: string,
  data: BalanceAccountCreate
): Promise<BalanceAccount> {
  const response = await apiClient.post<BalanceAccount>(
    `${BASE_URL}/${schoolId}/accounting/balance-accounts`,
    data
  );
  return response.data;
}

export async function updateBalanceAccount(
  schoolId: string,
  accountId: string,
  data: BalanceAccountUpdate
): Promise<BalanceAccount> {
  const response = await apiClient.patch<BalanceAccount>(
    `${BASE_URL}/${schoolId}/accounting/balance-accounts/${accountId}`,
    data
  );
  return response.data;
}

export async function deleteBalanceAccount(schoolId: string, accountId: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${schoolId}/accounting/balance-accounts/${accountId}`);
}

// Balance Entries (Movimientos)
export async function getBalanceEntries(
  schoolId: string,
  accountId: string,
  startDate?: string,
  endDate?: string
): Promise<BalanceEntry[]> {
  const response = await apiClient.get<BalanceEntry[]>(
    `${BASE_URL}/${schoolId}/accounting/balance-accounts/${accountId}/entries`,
    { params: { start_date: startDate, end_date: endDate } }
  );
  return response.data;
}

export async function createBalanceEntry(
  schoolId: string,
  accountId: string,
  data: BalanceEntryCreate
): Promise<BalanceEntry> {
  const response = await apiClient.post<BalanceEntry>(
    `${BASE_URL}/${schoolId}/accounting/balance-accounts/${accountId}/entries`,
    data
  );
  return response.data;
}

// Accounts Receivable (Cuentas por Cobrar)
export async function getAccountsReceivable(
  schoolId: string,
  options?: { isPaid?: boolean; isOverdue?: boolean; clientId?: string }
): Promise<AccountsReceivableListItem[]> {
  const response = await apiClient.get<AccountsReceivableListItem[]>(
    `${BASE_URL}/${schoolId}/accounting/receivables`,
    { params: { is_paid: options?.isPaid, is_overdue: options?.isOverdue, client_id: options?.clientId } }
  );
  return response.data;
}

export async function getAccountReceivable(schoolId: string, receivableId: string): Promise<AccountsReceivable> {
  const response = await apiClient.get<AccountsReceivable>(
    `${BASE_URL}/${schoolId}/accounting/receivables/${receivableId}`
  );
  return response.data;
}

export async function createAccountReceivable(
  schoolId: string,
  data: AccountsReceivableCreate
): Promise<AccountsReceivable> {
  const response = await apiClient.post<AccountsReceivable>(
    `${BASE_URL}/${schoolId}/accounting/receivables`,
    data
  );
  return response.data;
}

export async function payAccountReceivable(
  schoolId: string,
  receivableId: string,
  payment: AccountsReceivablePayment
): Promise<AccountsReceivable> {
  const response = await apiClient.post<AccountsReceivable>(
    `${BASE_URL}/${schoolId}/accounting/receivables/${receivableId}/pay`,
    payment
  );
  return response.data;
}

export async function deleteAccountReceivable(schoolId: string, receivableId: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${schoolId}/accounting/receivables/${receivableId}`);
}

// Accounts Payable (Cuentas por Pagar)
export async function getAccountsPayable(
  schoolId: string,
  options?: { isPaid?: boolean; isOverdue?: boolean; vendor?: string }
): Promise<AccountsPayableListItem[]> {
  const response = await apiClient.get<AccountsPayableListItem[]>(
    `${BASE_URL}/${schoolId}/accounting/payables`,
    { params: { is_paid: options?.isPaid, is_overdue: options?.isOverdue, vendor: options?.vendor } }
  );
  return response.data;
}

export async function getAccountPayable(schoolId: string, payableId: string): Promise<AccountsPayable> {
  const response = await apiClient.get<AccountsPayable>(
    `${BASE_URL}/${schoolId}/accounting/payables/${payableId}`
  );
  return response.data;
}

export async function createAccountPayable(
  schoolId: string,
  data: AccountsPayableCreate
): Promise<AccountsPayable> {
  const response = await apiClient.post<AccountsPayable>(
    `${BASE_URL}/${schoolId}/accounting/payables`,
    data
  );
  return response.data;
}

export async function payAccountPayable(
  schoolId: string,
  payableId: string,
  payment: AccountsPayablePayment
): Promise<AccountsPayable> {
  const response = await apiClient.post<AccountsPayable>(
    `${BASE_URL}/${schoolId}/accounting/payables/${payableId}/pay`,
    payment
  );
  return response.data;
}

export async function deleteAccountPayable(schoolId: string, payableId: string): Promise<void> {
  await apiClient.delete(`${BASE_URL}/${schoolId}/accounting/payables/${payableId}`);
}

// Helper functions for account types
export function getAccountTypeLabel(accountType: AccountType): string {
  const labels: Record<AccountType, string> = {
    asset_current: 'Activo Corriente',
    asset_fixed: 'Activo Fijo',
    asset_intangible: 'Activo Intangible',
    asset_other: 'Otros Activos',
    liability_current: 'Pasivo Corriente',
    liability_long: 'Pasivo a Largo Plazo',
    liability_other: 'Otros Pasivos',
    equity_capital: 'Capital',
    equity_retained: 'Utilidades Retenidas',
    equity_other: 'Otro Patrimonio'
  };
  return labels[accountType] || accountType;
}

export function getAccountTypeColor(accountType: AccountType): string {
  const colors: Record<AccountType, string> = {
    asset_current: 'bg-green-100 text-green-800',
    asset_fixed: 'bg-emerald-100 text-emerald-800',
    asset_intangible: 'bg-violet-100 text-violet-800',
    asset_other: 'bg-teal-100 text-teal-800',
    liability_current: 'bg-red-100 text-red-800',
    liability_long: 'bg-rose-100 text-rose-800',
    liability_other: 'bg-pink-100 text-pink-800',
    equity_capital: 'bg-blue-100 text-blue-800',
    equity_retained: 'bg-indigo-100 text-indigo-800',
    equity_other: 'bg-purple-100 text-purple-800'
  };
  return colors[accountType] || 'bg-gray-100 text-gray-800';
}

export function getAccountTypeCategory(accountType: AccountType): 'assets' | 'liabilities' | 'equity' {
  if (accountType.startsWith('asset')) return 'assets';
  if (accountType.startsWith('liability')) return 'liabilities';
  return 'equity';
}

// ============================================
// Cash Balances (Saldos de Caja y Banco)
// ============================================

export interface CashBalanceInfo {
  id: string;
  name: string;
  code?: string;
  balance: number;
  last_updated: string | null;
}

export interface CashBalancesResponse {
  // Legacy fields (for backward compatibility)
  caja: CashBalanceInfo | null;
  banco: CashBalanceInfo | null;
  total_liquid: number;
  // New 4-account structure
  caja_menor?: CashBalanceInfo | null;
  caja_mayor?: CashBalanceInfo | null;
  nequi?: CashBalanceInfo | null;
  total_cash?: number;
}

// Caja Menor / Liquidation types
export interface CajaMenorSummary {
  caja_menor_balance: number;
  caja_mayor_balance: number;
  today_liquidations: number;
  today_entries_count: number;
  date: string;
}

export interface LiquidationResult {
  success: boolean;
  message: string;
  caja_menor_balance: number;
  caja_mayor_balance: number;
  amount_liquidated: number;
}

export interface LiquidationHistoryItem {
  id: string;
  date: string;
  amount: number;
  balance_after: number;
  description: string;
  reference: string;
  created_at: string;
}

export const getCashBalances = async (schoolId: string): Promise<CashBalancesResponse> => {
  const response = await apiClient.get<CashBalancesResponse>(`${BASE_URL}/${schoolId}/accounting/cash-balances`);
  return response.data;
};

// Caja Menor functions
export const getCajaMenorBalance = async (schoolId: string): Promise<CashBalanceInfo> => {
  const response = await apiClient.get<CashBalanceInfo>(`${BASE_URL}/${schoolId}/accounting/caja-menor/balance`);
  return response.data;
};

export const getCajaMenorSummary = async (schoolId: string): Promise<CajaMenorSummary> => {
  const response = await apiClient.get<CajaMenorSummary>(`${BASE_URL}/${schoolId}/accounting/caja-menor/summary`);
  return response.data;
};

export const liquidateCajaMenor = async (
  schoolId: string,
  amount: number,
  notes?: string
): Promise<LiquidationResult> => {
  const response = await apiClient.post<LiquidationResult>(
    `${BASE_URL}/${schoolId}/accounting/caja-menor/liquidate`,
    null,
    { params: { amount, notes } }
  );
  return response.data;
};

export const getLiquidationHistory = async (
  schoolId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<LiquidationHistoryItem[]> => {
  const response = await apiClient.get<LiquidationHistoryItem[]>(
    `${BASE_URL}/${schoolId}/accounting/caja-menor/liquidation-history`,
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

export const initializeDefaultAccounts = async (
  schoolId: string,
  cajaInitialBalance: number = 0,
  bancoInitialBalance: number = 0
): Promise<{ message: string; accounts: Record<string, string> }> => {
  const response = await apiClient.post<{ message: string; accounts: Record<string, string> }>(
    `${BASE_URL}/${schoolId}/accounting/initialize-default-accounts`,
    null,
    { params: { caja_initial_balance: cajaInitialBalance, banco_initial_balance: bancoInitialBalance } }
  );
  return response.data;
};

// ============================================
// Patrimony (Patrimonio del Negocio)
// ============================================

export interface PatrimonySummary {
  assets: {
    cash_and_bank: {
      caja: CashBalanceInfo | null;
      banco: CashBalanceInfo | null;
      total: number;
    };
    inventory: {
      total_units: number;
      total_value: number;
      products_estimated: number;
      cost_margin_used: number;
    };
    accounts_receivable: {
      total: number;
      count: number;
      overdue_total: number;
      overdue_count: number;
    };
    fixed_assets: {
      total_value: number;
      count: number;
      breakdown: Array<{
        id: string;
        name: string;
        original_value: number;
        depreciation: number;
        net_value: number;
      }>;
    };
    intangible_assets?: {
      total_value: number;
      count: number;
      breakdown: Array<{
        id: string;
        name: string;
        original_value: number;
        amortization: number;
        net_value: number;
      }>;
    };
    total: number;
  };
  liabilities: {
    accounts_payable: {
      total: number;
      count: number;
      overdue_total: number;
      overdue_count: number;
    };
    debts: {
      short_term: number;
      long_term: number;
      total: number;
      breakdown: Array<{
        id: string;
        name: string;
        creditor: string;
        balance: number;
        interest_rate: number | null;
        due_date: string | null;
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

export interface InventoryValuation {
  total_units: number;
  total_value: number;
  products_with_cost: number;
  products_estimated: number;
  cost_margin_used: number;
  breakdown: Array<{
    product_id: string;
    product_code: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
    is_estimated: boolean;
    total_value: number;
    is_global?: boolean;
  }>;
}

export const getPatrimonySummary = async (schoolId: string): Promise<PatrimonySummary> => {
  const response = await apiClient.get<PatrimonySummary>(`${BASE_URL}/${schoolId}/accounting/patrimony/summary`);
  return response.data;
};

export const getInventoryValuation = async (schoolId: string): Promise<InventoryValuation> => {
  const response = await apiClient.get<InventoryValuation>(`${BASE_URL}/${schoolId}/accounting/patrimony/inventory-valuation`);
  return response.data;
};

export const setInitialBalance = async (
  schoolId: string,
  accountCode: string,
  initialBalance: number
): Promise<{ message: string; account_id: string; account_name: string; new_balance: number }> => {
  const response = await apiClient.post<{ message: string; account_id: string; account_name: string; new_balance: number }>(
    `${BASE_URL}/${schoolId}/accounting/patrimony/set-initial-balance`,
    null,
    { params: { account_code: accountCode, initial_balance: initialBalance } }
  );
  return response.data;
};

export const createDebt = async (
  schoolId: string,
  data: {
    name: string;
    amount: number;
    creditor: string;
    is_long_term?: boolean;
    interest_rate?: number;
    due_date?: string;
    description?: string;
  }
): Promise<{ message: string; debt_id: string; name: string; amount: number; creditor: string; is_long_term: boolean }> => {
  const response = await apiClient.post<{ message: string; debt_id: string; name: string; amount: number; creditor: string; is_long_term: boolean }>(
    `${BASE_URL}/${schoolId}/accounting/patrimony/debts`,
    null,
    { params: data }
  );
  return response.data;
};

export const getDebts = async (schoolId: string) => {
  const response = await apiClient.get(`${BASE_URL}/${schoolId}/accounting/patrimony/debts`);
  return response.data;
};

export const createFixedAsset = async (
  schoolId: string,
  data: {
    name: string;
    value: number;
    description?: string;
    useful_life_years?: number;
  }
): Promise<{ message: string; asset_id: string; name: string; value: number }> => {
  const response = await apiClient.post<{ message: string; asset_id: string; name: string; value: number }>(
    `${BASE_URL}/${schoolId}/accounting/patrimony/fixed-assets`,
    null,
    { params: data }
  );
  return response.data;
};

export const getFixedAssets = async (schoolId: string) => {
  const response = await apiClient.get(`${BASE_URL}/${schoolId}/accounting/patrimony/fixed-assets`);
  return response.data;
};

// Export as object for easier imports
export const accountingService = {
  getAccountingDashboard,
  getCashFlowSummary,
  getTransactions,
  getTransaction,
  createTransaction,
  getExpenses,
  getPendingExpenses,
  getExpensesByCategory,
  getExpense,
  createExpense,
  updateExpense,
  payExpense,
  deleteExpense,
  getTodayRegister,
  getRegisterByDate,
  openCashRegister,
  closeCashRegister,
  getExpenseCategoryLabel,
  getExpenseCategoryColor,
  getPaymentMethodLabel,
  // Balance General
  getBalanceGeneralSummary,
  getBalanceGeneralDetailed,
  getReceivablesPayablesSummary,
  // Balance Accounts
  getBalanceAccounts,
  getBalanceAccount,
  createBalanceAccount,
  updateBalanceAccount,
  deleteBalanceAccount,
  getBalanceEntries,
  createBalanceEntry,
  // Accounts Receivable
  getAccountsReceivable,
  getAccountReceivable,
  createAccountReceivable,
  payAccountReceivable,
  deleteAccountReceivable,
  // Accounts Payable
  getAccountsPayable,
  getAccountPayable,
  createAccountPayable,
  payAccountPayable,
  deleteAccountPayable,
  // Helpers
  getAccountTypeLabel,
  getAccountTypeColor,
  getAccountTypeCategory,
  // Cash Balances (Caja/Banco)
  getCashBalances,
  initializeDefaultAccounts,
  // Caja Menor / Liquidation
  getCajaMenorBalance,
  getCajaMenorSummary,
  liquidateCajaMenor,
  getLiquidationHistory,
  // Patrimony (Patrimonio)
  getPatrimonySummary,
  getInventoryValuation,
  setInitialBalance,
  createDebt,
  getDebts,
  createFixedAsset,
  getFixedAssets
};
