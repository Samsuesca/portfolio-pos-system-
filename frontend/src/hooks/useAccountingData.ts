/**
 * useAccountingData - Consolidated data loading hook for Accounting page
 *
 * This hook manages all data fetching and state for the accounting module.
 */
import { useState, useEffect, useCallback } from 'react';
import { globalAccountingService } from '../services/globalAccountingService';
import { getColombiaDateString } from '../utils/formatting';
import {
  getFixedExpenses,
  getPendingGeneration
} from '../services/fixedExpenseService';
import type { CashBalancesResponse } from '../services/accountingService';
import type {
  GlobalPatrimonySummary,
  GlobalBalanceAccountResponse,
  DailyFlowResponse,
  IncomeStatementResponse,
  BalanceSheetResponse,
  PeriodPreset,
  AccountsReceivableListItem,
  ReceivablesPayablesSummary
} from '../services/globalAccountingService';
import type {
  ExpenseListItem,
  AccountsPayableListItem,
  CashProjectionResponse,
  DebtPaymentListResponse
} from '../types/api';
import type {
  FixedExpenseListItem,
  PendingGenerationResponse
} from '../services/fixedExpenseService';

// Type for dashboard summary
interface GlobalDashboardSummary {
  total_expenses: number;
  cash_balance: number;
  expenses_pending: number;
  expenses_paid: number;
  transaction_count: number;
}

// Type for balance account modal
type BalanceAccountModalType = 'asset_fixed' | 'liability_current' | 'liability_long';

// Return type for the hook
interface UseAccountingDataReturn {
  // Loading and error states
  loading: boolean;
  error: string | null;

  // Summary data
  dashboard: GlobalDashboardSummary | null;
  cashBalances: CashBalancesResponse | null;
  patrimony: GlobalPatrimonySummary | null;
  pendingExpenses: ExpenseListItem[];

  // Operations data
  dailyFlow: DailyFlowResponse | null;
  dailyFlowDate: string;
  setDailyFlowDate: (date: string) => void;
  loadingDailyFlow: boolean;

  // Receivables/Payables data
  receivablesSummary: ReceivablesPayablesSummary | null;
  receivablesList: AccountsReceivableListItem[];
  payablesList: AccountsPayableListItem[];

  // Planning data
  fixedExpensesList: FixedExpenseListItem[];
  pendingGeneration: PendingGenerationResponse | null;
  fixedExpensesFilter: 'all' | 'active' | 'inactive';
  setFixedExpensesFilter: (filter: 'all' | 'active' | 'inactive') => void;
  cashProjection: CashProjectionResponse | null;
  debtPayments: DebtPaymentListResponse | null;
  planningGrowthFactor: number;
  setPlanningGrowthFactor: (factor: number) => void;
  loadingPlanning: boolean;

  // Financial Statements data
  incomeStatement: IncomeStatementResponse | null;
  balanceSheet: BalanceSheetResponse | null;
  availablePeriods: PeriodPreset[];
  loadingStatements: boolean;
  statementsError: string | null;

  // Balance Accounts modal data
  balanceAccountsList: GlobalBalanceAccountResponse[];
  loadingAccounts: boolean;

  // Refresh functions
  loadData: () => Promise<void>;
  loadReceivablesPayables: () => Promise<void>;
  loadFixedExpenses: () => Promise<void>;
  loadPlanningData: () => Promise<void>;
  loadDailyFlow: (date: string) => Promise<void>;
  loadBalanceAccounts: (type: BalanceAccountModalType) => Promise<void>;
  loadIncomeStatement: (startDate: string, endDate: string, comparePrevious?: boolean) => Promise<void>;
  loadBalanceSheet: (asOfDate?: string) => Promise<void>;
}

export const useAccountingData = (): UseAccountingDataReturn => {
  // Core loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary data
  const [dashboard, setDashboard] = useState<GlobalDashboardSummary | null>(null);
  const [cashBalances, setCashBalances] = useState<CashBalancesResponse | null>(null);
  const [patrimony, setPatrimony] = useState<GlobalPatrimonySummary | null>(null);
  const [pendingExpenses, setPendingExpenses] = useState<ExpenseListItem[]>([]);

  // Operations data
  const [dailyFlow, setDailyFlow] = useState<DailyFlowResponse | null>(null);
  const [dailyFlowDate, setDailyFlowDate] = useState(getColombiaDateString());
  const [loadingDailyFlow, setLoadingDailyFlow] = useState(false);

  // Receivables/Payables data
  const [receivablesSummary, setReceivablesSummary] = useState<ReceivablesPayablesSummary | null>(null);
  const [receivablesList, setReceivablesList] = useState<AccountsReceivableListItem[]>([]);
  const [payablesList, setPayablesList] = useState<AccountsPayableListItem[]>([]);

  // Planning data
  const [fixedExpensesList, setFixedExpensesList] = useState<FixedExpenseListItem[]>([]);
  const [pendingGeneration, setPendingGeneration] = useState<PendingGenerationResponse | null>(null);
  const [fixedExpensesFilter, setFixedExpensesFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [cashProjection, setCashProjection] = useState<CashProjectionResponse | null>(null);
  const [debtPayments, setDebtPayments] = useState<DebtPaymentListResponse | null>(null);
  const [planningGrowthFactor, setPlanningGrowthFactor] = useState(1.0);
  const [loadingPlanning, setLoadingPlanning] = useState(false);

  // Financial Statements
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementResponse | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResponse | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<PeriodPreset[]>([]);
  const [loadingStatements, setLoadingStatements] = useState(false);
  const [statementsError, setStatementsError] = useState<string | null>(null);

  // Balance Accounts
  const [balanceAccountsList, setBalanceAccountsList] = useState<GlobalBalanceAccountResponse[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Load core data (dashboard, cash balances, patrimony)
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [balancesRes, patrimonySummary, pendingExpensesRes, paidExpensesRes] = await Promise.all([
        globalAccountingService.getCashBalances(),
        globalAccountingService.getPatrimonySummary(),
        globalAccountingService.getGlobalExpenses({ isPaid: false, limit: 500 }),
        globalAccountingService.getGlobalExpenses({ isPaid: true, limit: 500 })
      ]);

      setCashBalances(balancesRes);
      setPatrimony(patrimonySummary);
      setPendingExpenses(pendingExpensesRes.slice(0, 20));

      // Calculate dashboard summary from arrays
      const pendingTotal = pendingExpensesRes.reduce((sum, e) => sum + Number(e.amount) - Number(e.amount_paid), 0);
      const paidTotal = paidExpensesRes.reduce((sum, e) => sum + Number(e.amount), 0);
      const allTotal = pendingExpensesRes.reduce((sum, e) => sum + Number(e.amount), 0) + paidTotal;

      setDashboard({
        total_expenses: allTotal,
        cash_balance: balancesRes.total_liquid || 0,
        expenses_pending: pendingTotal,
        expenses_paid: paidTotal,
        transaction_count: pendingExpensesRes.length + paidExpensesRes.length
      });

      // Load periods for statements
      const periodsData = await globalAccountingService.getAvailablePeriods();
      setAvailablePeriods(periodsData.presets);
    } catch (err: unknown) {
      console.error('Error loading accounting data:', err);
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setError(errorObj.response?.data?.detail || 'Error al cargar datos contables');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load daily flow
  const loadDailyFlow = useCallback(async (date: string) => {
    setLoadingDailyFlow(true);
    try {
      const flow = await globalAccountingService.getDailyFlow(date);
      setDailyFlow(flow);
    } catch (err) {
      console.error('Error loading daily flow:', err);
    } finally {
      setLoadingDailyFlow(false);
    }
  }, []);

  // Load receivables and payables
  const loadReceivablesPayables = useCallback(async () => {
    try {
      const [summary, receivables, payables] = await Promise.all([
        globalAccountingService.getReceivablesPayables(),
        globalAccountingService.getReceivables({ isPaid: false, limit: 50 }),
        globalAccountingService.getPayables({ isPaid: false, limit: 50 })
      ]);
      setReceivablesSummary(summary);
      setReceivablesList(receivables);
      setPayablesList(payables);
    } catch (err) {
      console.error('Error loading receivables/payables:', err);
    }
  }, []);

  // Load fixed expenses
  const loadFixedExpenses = useCallback(async () => {
    try {
      const isActive = fixedExpensesFilter === 'active' ? true : fixedExpensesFilter === 'inactive' ? false : undefined;
      const [expenses, pending] = await Promise.all([
        getFixedExpenses({ is_active: isActive, limit: 100 }),
        getPendingGeneration()
      ]);
      setFixedExpensesList(expenses || []);
      setPendingGeneration(pending);
    } catch (err) {
      console.error('Error loading fixed expenses:', err);
    }
  }, [fixedExpensesFilter]);

  // Load planning data
  const loadPlanningData = useCallback(async () => {
    setLoadingPlanning(true);
    try {
      const [projectionData, debtData] = await Promise.all([
        globalAccountingService.getCashProjection({
          months: 6,
          growth_factor: planningGrowthFactor,
          liquidity_threshold: 1000000
        }),
        globalAccountingService.getDebtPayments({ limit: 20 })
      ]);
      setCashProjection(projectionData);
      setDebtPayments(debtData);
    } catch (err) {
      console.error('Error loading planning data:', err);
    } finally {
      setLoadingPlanning(false);
    }
  }, [planningGrowthFactor]);

  // Load balance accounts
  const loadBalanceAccounts = useCallback(async (type: BalanceAccountModalType) => {
    setLoadingAccounts(true);
    try {
      const accounts = await globalAccountingService.getBalanceAccounts(type);
      // Map to the expected type
      const mappedAccounts: GlobalBalanceAccountResponse[] = accounts.map(acc => ({
        id: acc.id,
        school_id: null,
        account_type: acc.account_type,
        name: acc.name,
        description: acc.description || null,
        code: acc.code,
        balance: acc.balance,
        original_value: acc.original_value || null,
        accumulated_depreciation: acc.accumulated_depreciation || null,
        useful_life_years: acc.useful_life_years || null,
        interest_rate: acc.interest_rate || null,
        due_date: acc.due_date || null,
        creditor: acc.creditor || null,
        net_value: acc.net_value,
        is_active: acc.is_active,
        created_by: null,
        created_at: '',
        updated_at: ''
      }));
      setBalanceAccountsList(mappedAccounts);
    } catch (err) {
      console.error('Error loading balance accounts:', err);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  // Load income statement
  const loadIncomeStatement = useCallback(async (startDate: string, endDate: string, comparePrevious?: boolean) => {
    setLoadingStatements(true);
    setStatementsError(null);
    try {
      const data = await globalAccountingService.getIncomeStatement(startDate, endDate, comparePrevious);
      setIncomeStatement(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setStatementsError(errorObj.response?.data?.detail || 'Error al cargar el estado de resultados');
    } finally {
      setLoadingStatements(false);
    }
  }, []);

  // Load balance sheet
  const loadBalanceSheet = useCallback(async (asOfDate?: string) => {
    setLoadingStatements(true);
    setStatementsError(null);
    try {
      const data = await globalAccountingService.getBalanceSheet(asOfDate);
      setBalanceSheet(data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string } } };
      setStatementsError(errorObj.response?.data?.detail || 'Error al cargar el balance general');
    } finally {
      setLoadingStatements(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load daily flow when date changes
  useEffect(() => {
    if (dailyFlowDate) {
      loadDailyFlow(dailyFlowDate);
    }
  }, [dailyFlowDate, loadDailyFlow]);

  // Load fixed expenses when filter changes
  useEffect(() => {
    loadFixedExpenses();
  }, [loadFixedExpenses]);

  return {
    // Loading and error states
    loading,
    error,

    // Summary data
    dashboard,
    cashBalances,
    patrimony,
    pendingExpenses,

    // Operations data
    dailyFlow,
    dailyFlowDate,
    setDailyFlowDate,
    loadingDailyFlow,

    // Receivables/Payables data
    receivablesSummary,
    receivablesList,
    payablesList,

    // Planning data
    fixedExpensesList,
    pendingGeneration,
    fixedExpensesFilter,
    setFixedExpensesFilter,
    cashProjection,
    debtPayments,
    planningGrowthFactor,
    setPlanningGrowthFactor,
    loadingPlanning,

    // Financial Statements data
    incomeStatement,
    balanceSheet,
    availablePeriods,
    loadingStatements,
    statementsError,

    // Balance Accounts modal data
    balanceAccountsList,
    loadingAccounts,

    // Refresh functions
    loadData,
    loadReceivablesPayables,
    loadFixedExpenses,
    loadPlanningData,
    loadDailyFlow,
    loadBalanceAccounts,
    loadIncomeStatement,
    loadBalanceSheet
  };
};

export default useAccountingData;
