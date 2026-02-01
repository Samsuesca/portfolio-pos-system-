/**
 * Accounting Page - Refactored version using modular components
 *
 * Main orchestrator for the accounting module with 5 tabs:
 * - Summary: Dashboard + Patrimony
 * - Expenses: Dedicated expense management
 * - Operations: Cash register / Daily flow
 * - Receivables/Payables: CxC and CxP management
 * - Planning: Fixed expenses + Financial projections
 */
import { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import {
  Calculator, Plus, Loader2, AlertCircle, Receipt, Wallet, DollarSign, LineChart, ArrowRightLeft
} from 'lucide-react';
import { getColombiaDateString } from '../utils/formatting';

// Import accounting components
import {
  ExpensesTab,
  SummaryDashboard,
  BalancePatrimony,
  FinancialStatements,
  CashRegister,
  CajaMenorAutoClose,
  TransferModal,
  TransferHistory,
  AccountsReceivable,
  AccountsPayable,
  FixedExpensesPanel,
  PlanningDashboardSummary,
  CashProjectionChart,
  SalesSeasonalityChart,
  DebtSchedulePanel,
  ProductCostManager,
  EditBalanceModal,
  ReceivableModal,
  PayableModal,
  PaymentModal,
  BalanceAccountsModal,
  CreateExpenseModal,
  type TabType,
  type BalanceAccountModalType,
  type GlobalDashboardSummary,
  type ExpenseListItem,
  type AccountsReceivableCreate,
  type AccountsPayableCreate,
  type AccountsReceivableListItem,
  type AccountsPayableListItem,
  type AccPaymentMethod,
  type FixedExpenseCreate,
  type FixedExpenseUpdate,
  getErrorMessage
} from '../components/accounting';

// Services
import { globalAccountingService } from '../services/globalAccountingService';
import {
  getFixedExpenses,
  createFixedExpense,
  updateFixedExpense,
  deleteFixedExpense,
  generateExpenses,
  getPendingGeneration
} from '../services/fixedExpenseService';
import type { CashBalancesResponse } from '../services/accountingService';
import type {
  GlobalPatrimonySummary,
  GlobalBalanceAccountCreate,
  GlobalBalanceAccountResponse,
  DailyFlowResponse,
  IncomeStatementResponse,
  BalanceSheetResponse,
  PeriodPreset
} from '../services/globalAccountingService';
import type {
  ReceivablesPayablesSummary,
  PlanningDashboard,
  CashProjectionResponse,
  CashProjectionParams,
  DebtPaymentListResponse,
  DebtPaymentCreate,
  SalesSeasonalityResponse
} from '../types/api';
import type {
  FixedExpenseListItem,
  PendingGenerationResponse
} from '../services/fixedExpenseService';

// Stores and hooks
import { useSchoolStore } from '../stores/schoolStore';
import { useUserRole } from '../hooks/useUserRole';
import { usePermissions } from '../hooks/usePermissions';

export default function Accounting() {
  // Store and permissions
  useSchoolStore(); // Keep subscription active for navbar
  useUserRole(); // Keep permissions active
  const {
    canAdjustBalance,
    canViewDailyFlow,
  } = usePermissions();

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [submitting, setSubmitting] = useState(false);

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
  const [generatingExpenses, setGeneratingExpenses] = useState(false);

  // Planning dashboard data
  const [planningDashboard, setPlanningDashboard] = useState<PlanningDashboard | null>(null);
  const [cashProjection, setCashProjection] = useState<CashProjectionResponse | null>(null);
  const [debtPayments, setDebtPayments] = useState<DebtPaymentListResponse | null>(null);
  const [salesSeasonality, setSalesSeasonality] = useState<SalesSeasonalityResponse | null>(null);
  const [projectionParams, setProjectionParams] = useState<CashProjectionParams>({ months: 6 });
  const [loadingPlanning, setLoadingPlanning] = useState(false);

  // Financial Statements data
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementResponse | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetResponse | null>(null);
  const [availablePeriods, setAvailablePeriods] = useState<PeriodPreset[]>([]);
  const [loadingStatements, setLoadingStatements] = useState(false);
  const [statementsError, setStatementsError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [comparePrevious, setComparePrevious] = useState(false);
  const [activeStatementTab, setActiveStatementTab] = useState<'income' | 'balance'>('income');

  // Balance Accounts modal
  const [showAssetsModal, setShowAssetsModal] = useState(false);
  const [assetsModalType, setAssetsModalType] = useState<BalanceAccountModalType>('asset_fixed');
  const [balanceAccountsList, setBalanceAccountsList] = useState<GlobalBalanceAccountResponse[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // Edit Balance modal
  const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<'caja_menor' | 'caja_mayor' | 'nequi' | 'banco' | null>(null);
  const [newBalanceValue, setNewBalanceValue] = useState(0);

  // Receivable modal
  const [showReceivableModal, setShowReceivableModal] = useState(false);
  const [receivableForm, setReceivableForm] = useState<Partial<AccountsReceivableCreate>>({
    description: '',
    amount: 0,
    invoice_date: getColombiaDateString()
  });

  // Payable modal
  const [showPayableModal, setShowPayableModal] = useState(false);
  const [payableForm, setPayableForm] = useState<Partial<AccountsPayableCreate>>({
    vendor: '',
    description: '',
    amount: 0,
    invoice_date: getColombiaDateString()
  });

  // Payment modals
  const [showPayReceivableModal, setShowPayReceivableModal] = useState(false);
  const [selectedReceivable, setSelectedReceivable] = useState<AccountsReceivableListItem | null>(null);
  const [showPayPayableModal, setShowPayPayableModal] = useState(false);
  const [selectedPayable, setSelectedPayable] = useState<AccountsPayableListItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<AccPaymentMethod | ''>('');

  // Expense modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_editingExpense, setEditingExpense] = useState<ExpenseListItem | null>(null);

  // Product cost manager modal
  const [showProductCostModal, setShowProductCostModal] = useState(false);

  // Transfer modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferRefreshTrigger, setTransferRefreshTrigger] = useState(0);

  // ============= DATA LOADING =============

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
    } catch (err: any) {
      setError(getErrorMessage(err, 'Error al cargar datos contables'));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const loadReceivablesPayables = useCallback(async () => {
    try {
      const [summary, receivables, payables] = await Promise.all([
        globalAccountingService.getReceivablesPayables(),
        globalAccountingService.getReceivables({ isPaid: false, limit: 50 }),
        globalAccountingService.getPayables({ isPaid: false, limit: 50 })
      ]);
      setReceivablesSummary(summary);
      setReceivablesList(receivables || []);
      setPayablesList(payables || []);
    } catch (err) {
      console.error('Error loading receivables/payables:', err);
    }
  }, []);

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

  const loadPlanningData = useCallback(async () => {
    setLoadingPlanning(true);
    try {
      const [dashboard, projection, debts, seasonality] = await Promise.all([
        globalAccountingService.getPlanningDashboard(),
        globalAccountingService.getCashProjection(projectionParams),
        globalAccountingService.getDebtPayments({}),
        globalAccountingService.getSalesSeasonality()
      ]);
      setPlanningDashboard(dashboard);
      setCashProjection(projection);
      setDebtPayments(debts);
      setSalesSeasonality(seasonality);
    } catch (err) {
      console.error('Error loading planning data:', err);
    } finally {
      setLoadingPlanning(false);
    }
  }, [projectionParams]);

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

  // ============= EFFECTS =============

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'operations') {
      loadDailyFlow(dailyFlowDate);
    }
  }, [activeTab, dailyFlowDate, loadDailyFlow]);

  useEffect(() => {
    if (activeTab === 'receivables_payables') {
      loadReceivablesPayables();
    }
  }, [activeTab, loadReceivablesPayables]);

  useEffect(() => {
    if (activeTab === 'planning') {
      loadFixedExpenses();
      loadPlanningData();
    }
  }, [activeTab, loadFixedExpenses, loadPlanningData]);

  // ============= HANDLERS =============

  const handleEditBalance = (account: 'caja_menor' | 'caja_mayor' | 'nequi' | 'banco') => {
    setEditingAccount(account);
    setNewBalanceValue(0);
    setShowEditBalanceModal(true);
  };

  const handleSaveBalance = async () => {
    if (!editingAccount || !cashBalances) return;
    setSubmitting(true);
    try {
      const accountId = cashBalances[editingAccount]?.id;
      if (!accountId) return;
      await globalAccountingService.updateBalanceAccount(accountId, { balance: newBalanceValue });
      setShowEditBalanceModal(false);
      setEditingAccount(null);
      loadData();
    } catch (err) {
      console.error('Error updating balance:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManageAssets = (type: BalanceAccountModalType) => {
    setAssetsModalType(type);
    setShowAssetsModal(true);
    loadBalanceAccounts(type);
  };

  const handleCreateBalanceAccount = async (data: GlobalBalanceAccountCreate) => {
    await globalAccountingService.createBalanceAccount(data);
    loadBalanceAccounts(assetsModalType);
    loadData();
  };

  const handleUpdateBalanceAccount = async (id: string, data: Partial<GlobalBalanceAccountCreate>) => {
    await globalAccountingService.updateBalanceAccount(id, data);
    loadBalanceAccounts(assetsModalType);
    loadData();
  };

  const handleDeleteBalanceAccount = async (id: string) => {
    await globalAccountingService.deleteBalanceAccount(id);
    loadBalanceAccounts(assetsModalType);
    loadData();
  };

  const handleCreateReceivable = async () => {
    if (!receivableForm.description || !receivableForm.amount) return;
    setSubmitting(true);
    try {
      await globalAccountingService.createReceivable(receivableForm as AccountsReceivableCreate);
      setShowReceivableModal(false);
      setReceivableForm({ description: '', amount: 0, invoice_date: getColombiaDateString() });
      loadReceivablesPayables();
      loadData();
    } catch (err) {
      console.error('Error creating receivable:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreatePayable = async () => {
    if (!payableForm.vendor || !payableForm.description || !payableForm.amount) return;
    setSubmitting(true);
    try {
      await globalAccountingService.createPayable(payableForm as AccountsPayableCreate);
      setShowPayableModal(false);
      setPayableForm({ vendor: '', description: '', amount: 0, invoice_date: getColombiaDateString() });
      loadReceivablesPayables();
      loadData();
    } catch (err) {
      console.error('Error creating payable:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayReceivable = async () => {
    if (!selectedReceivable || !paymentMethod || paymentAmount <= 0) return;
    setSubmitting(true);
    try {
      // Convert nequi to transfer for backend compatibility
      const backendMethod = paymentMethod === 'nequi' ? 'transfer' : paymentMethod;
      await globalAccountingService.payReceivable(selectedReceivable.id, {
        amount: paymentAmount,
        payment_method: backendMethod as 'cash' | 'transfer' | 'card'
      });
      setShowPayReceivableModal(false);
      setSelectedReceivable(null);
      setPaymentAmount(0);
      setPaymentMethod('');
      loadReceivablesPayables();
      loadData();
    } catch (err) {
      console.error('Error paying receivable:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayPayable = async () => {
    if (!selectedPayable || !paymentMethod || paymentAmount <= 0) return;
    setSubmitting(true);
    try {
      await globalAccountingService.payPayable(selectedPayable.id, {
        amount: paymentAmount,
        payment_method: paymentMethod
      });
      setShowPayPayableModal(false);
      setSelectedPayable(null);
      setPaymentAmount(0);
      setPaymentMethod('');
      loadReceivablesPayables();
      loadData();
    } catch (err) {
      console.error('Error paying payable:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFixedExpense = async (data: FixedExpenseCreate) => {
    await createFixedExpense(data);
    loadFixedExpenses();
  };

  const handleUpdateFixedExpense = async (id: string, data: FixedExpenseUpdate) => {
    await updateFixedExpense(id, data);
    loadFixedExpenses();
  };

  const handleDeleteFixedExpense = async (id: string) => {
    await deleteFixedExpense(id);
    loadFixedExpenses();
  };

  const handleGenerateExpenses = async () => {
    setGeneratingExpenses(true);
    try {
      await generateExpenses();
      loadFixedExpenses();
      loadData();
    } catch (err) {
      console.error('Error generating expenses:', err);
    } finally {
      setGeneratingExpenses(false);
    }
  };

  // Debt handlers
  const handleCreateDebt = async (data: DebtPaymentCreate) => {
    setSubmitting(true);
    try {
      await globalAccountingService.createDebtPayment(data);
      loadPlanningData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkDebtPaid = async (id: string, amount: number, method: string) => {
    setSubmitting(true);
    try {
      const today = getColombiaDateString();
      // Use caja_menor as default payment account (needs proper account selection in future)
      const paymentAccountId = cashBalances?.caja_menor?.id || '';
      await globalAccountingService.markDebtPaymentAsPaid(id, today, amount, method, paymentAccountId);
      loadPlanningData();
      loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDebt = async (id: string) => {
    setSubmitting(true);
    try {
      await globalAccountingService.deleteDebtPayment(id);
      loadPlanningData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleProjectionParamsChange = (params: CashProjectionParams) => {
    setProjectionParams(params);
  };

  const handleSeasonalityYearChange = (startYear: number, endYear: number) => {
    // Note: This would require adding year params to service call
    console.log('Year range changed:', startYear, endYear);
  };

  const handleGenerateIncomeStatement = async () => {
    setLoadingStatements(true);
    setStatementsError(null);
    try {
      let startDate: string;
      let endDate: string;

      if (selectedPeriod === 'custom') {
        if (!customStartDate || !customEndDate) {
          setStatementsError('Selecciona las fechas de inicio y fin');
          setLoadingStatements(false);
          return;
        }
        startDate = customStartDate;
        endDate = customEndDate;
      } else {
        const period = availablePeriods.find(p => p.key === selectedPeriod);
        if (!period) {
          setStatementsError('Periodo no encontrado');
          setLoadingStatements(false);
          return;
        }
        startDate = period.start_date;
        endDate = period.end_date;
      }

      const data = await globalAccountingService.getIncomeStatement(startDate, endDate, comparePrevious);
      setIncomeStatement(data);
    } catch (err: any) {
      setStatementsError(getErrorMessage(err, 'Error al cargar el estado de resultados'));
    } finally {
      setLoadingStatements(false);
    }
  };

  const handleGenerateBalanceSheet = async () => {
    setLoadingStatements(true);
    setStatementsError(null);
    try {
      const asOfDate = customEndDate || undefined;
      const data = await globalAccountingService.getBalanceSheet(asOfDate);
      setBalanceSheet(data);
    } catch (err: any) {
      setStatementsError(getErrorMessage(err, 'Error al cargar el balance general'));
    } finally {
      setLoadingStatements(false);
    }
  };

  // ============= RENDER HELPERS =============

  const renderActionButton = () => {
    if (activeTab === 'summary' || activeTab === 'operations') {
      return (
        <button
          onClick={() => setShowExpenseModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nuevo Gasto
        </button>
      );
    }
    return null;
  };

  const renderTabs = () => (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-4 overflow-x-auto">
        {[
          { key: 'summary', label: 'Resumen', icon: Calculator },
          { key: 'expenses', label: 'Gastos', icon: Receipt },
          { key: 'operations', label: 'Operaciones', icon: Wallet },
          { key: 'receivables_payables', label: 'CxC / CxP', icon: DollarSign },
          { key: 'planning', label: 'Planificacion', icon: LineChart }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as TabType)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
              ${activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );

  // ============= LOADING/ERROR STATES =============

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando contabilidad...</span>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={() => loadData()}
                className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // ============= MAIN RENDER =============

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <Calculator className="w-8 h-8 mr-3 text-blue-600" />
            Contabilidad
          </h1>
          <p className="text-gray-600 mt-1">Gestion financiera y balance general</p>
        </div>
        {renderActionButton()}
      </div>

      {/* Tab Navigation */}
      {renderTabs()}

      {/* Tab Content */}
      {activeTab === 'summary' && (
        <div className="space-y-8">
          <SummaryDashboard
            dashboard={dashboard}
            cashBalances={cashBalances}
            patrimony={patrimony}
            pendingExpenses={pendingExpenses}
            onGoToExpenses={() => setActiveTab('expenses')}
            onEditBalance={canAdjustBalance ? handleEditBalance : undefined}
            onCreateExpense={() => setShowExpenseModal(true)}
            onEditExpense={(expense) => {
              setEditingExpense(expense);
              setShowExpenseModal(true);
            }}
            onPayExpense={() => {
              // For now, redirect to expenses tab
              setActiveTab('expenses');
            }}
            onGoToProducts={() => setShowProductCostModal(true)}
            onTransfer={() => setShowTransferModal(true)}
          />

          <BalancePatrimony
            patrimony={patrimony}
            onManageAssets={handleManageAssets}
          />

          <FinancialStatements
            activeStatementTab={activeStatementTab}
            onTabChange={setActiveStatementTab}
            selectedPeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
            onCustomStartDateChange={setCustomStartDate}
            onCustomEndDateChange={setCustomEndDate}
            comparePrevious={comparePrevious}
            onComparePreviousChange={setComparePrevious}
            availablePeriods={availablePeriods}
            incomeStatement={incomeStatement}
            balanceSheet={balanceSheet}
            loadingStatements={loadingStatements}
            statementsError={statementsError}
            onGenerateIncomeStatement={handleGenerateIncomeStatement}
            onGenerateBalanceSheet={handleGenerateBalanceSheet}
          />
        </div>
      )}

      {activeTab === 'expenses' && (
        <ExpensesTab
          cashBalances={cashBalances}
          onDataChange={() => loadData(true)}
          onCreateExpense={() => setShowExpenseModal(true)}
        />
      )}

      {activeTab === 'operations' && (
        canViewDailyFlow ? (
          <div className="space-y-6">
            <CashRegister
              dailyFlow={dailyFlow}
              dailyFlowDate={dailyFlowDate}
              onDateChange={(date) => {
                setDailyFlowDate(date);
                loadDailyFlow(date);
              }}
              loading={loadingDailyFlow}
            />

            {/* Caja Menor Auto-close + Transfer button */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CajaMenorAutoClose
                cajaMenorBalance={cashBalances?.caja_menor?.balance || 0}
                onAutoCloseComplete={() => {
                  loadData(true);
                  setTransferRefreshTrigger((prev) => prev + 1);
                }}
              />

              {/* Quick Transfer Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <ArrowRightLeft className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Transferencias entre Cuentas</h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                  Mueve dinero entre Caja Menor, Caja Mayor, Nequi y Banco
                </p>
                <button
                  onClick={() => setShowTransferModal(true)}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Nueva Transferencia
                </button>
              </div>
            </div>

            {/* Transfer History */}
            <TransferHistory refreshTrigger={transferRefreshTrigger} />
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <p className="text-yellow-800">No tienes permiso para ver el flujo diario de operaciones.</p>
          </div>
        )
      )}

      {activeTab === 'receivables_payables' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <AccountsReceivable
            summary={receivablesSummary}
            receivablesList={receivablesList}
            onCreateReceivable={() => setShowReceivableModal(true)}
            onPayReceivable={(item) => {
              setSelectedReceivable(item);
              setPaymentAmount(item.balance);
              setPaymentMethod('');
              setShowPayReceivableModal(true);
            }}
          />

          <AccountsPayable
            summary={receivablesSummary}
            payablesList={payablesList}
            onCreatePayable={() => setShowPayableModal(true)}
            onPayPayable={(item) => {
              setSelectedPayable(item);
              setPaymentAmount(item.balance);
              setPaymentMethod('');
              setShowPayPayableModal(true);
            }}
          />
        </div>
      )}

      {activeTab === 'planning' && (
        <div className="space-y-6">
          {/* Planning Dashboard Summary */}
          <PlanningDashboardSummary
            dashboard={planningDashboard}
            loading={loadingPlanning}
          />

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CashProjectionChart
              projection={cashProjection}
              onParamsChange={handleProjectionParamsChange}
              loading={loadingPlanning}
            />
            <SalesSeasonalityChart
              data={salesSeasonality}
              onYearRangeChange={handleSeasonalityYearChange}
              loading={loadingPlanning}
            />
          </div>

          {/* Debt Schedule and Fixed Expenses Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DebtSchedulePanel
              debtPayments={debtPayments}
              onCreateDebt={handleCreateDebt}
              onMarkPaid={handleMarkDebtPaid}
              onDelete={handleDeleteDebt}
              onRefresh={loadPlanningData}
              loading={loadingPlanning}
              submitting={submitting}
            />
            <FixedExpensesPanel
              fixedExpensesList={fixedExpensesList}
              pendingGeneration={pendingGeneration}
              filter={fixedExpensesFilter}
              onFilterChange={setFixedExpensesFilter}
              onCreateExpense={handleCreateFixedExpense}
              onUpdateExpense={handleUpdateFixedExpense}
              onDeleteExpense={handleDeleteFixedExpense}
              onGenerateExpenses={handleGenerateExpenses}
              submitting={submitting}
              generatingExpenses={generatingExpenses}
            />
          </div>
        </div>
      )}

      {/* ============= MODALS ============= */}

      <EditBalanceModal
        isOpen={showEditBalanceModal}
        editingAccount={editingAccount}
        cashBalances={cashBalances}
        newBalanceValue={newBalanceValue}
        onBalanceChange={setNewBalanceValue}
        onSave={handleSaveBalance}
        onClose={() => {
          setShowEditBalanceModal(false);
          setEditingAccount(null);
        }}
        submitting={submitting}
      />

      <ReceivableModal
        isOpen={showReceivableModal}
        form={receivableForm}
        onFormChange={setReceivableForm}
        onSubmit={handleCreateReceivable}
        onClose={() => setShowReceivableModal(false)}
        submitting={submitting}
      />

      <PayableModal
        isOpen={showPayableModal}
        form={payableForm}
        onFormChange={setPayableForm}
        onSubmit={handleCreatePayable}
        onClose={() => setShowPayableModal(false)}
        submitting={submitting}
      />

      <PaymentModal
        isOpen={showPayReceivableModal}
        type="receivable"
        item={selectedReceivable}
        paymentAmount={paymentAmount}
        paymentMethod={paymentMethod}
        onAmountChange={setPaymentAmount}
        onMethodChange={setPaymentMethod}
        onSubmit={handlePayReceivable}
        onClose={() => {
          setShowPayReceivableModal(false);
          setSelectedReceivable(null);
        }}
        submitting={submitting}
      />

      <PaymentModal
        isOpen={showPayPayableModal}
        type="payable"
        item={selectedPayable}
        paymentAmount={paymentAmount}
        paymentMethod={paymentMethod}
        onAmountChange={setPaymentAmount}
        onMethodChange={setPaymentMethod}
        onSubmit={handlePayPayable}
        onClose={() => {
          setShowPayPayableModal(false);
          setSelectedPayable(null);
        }}
        submitting={submitting}
      />

      <BalanceAccountsModal
        isOpen={showAssetsModal}
        modalType={assetsModalType}
        accounts={balanceAccountsList}
        loading={loadingAccounts}
        onClose={() => setShowAssetsModal(false)}
        onCreate={handleCreateBalanceAccount}
        onUpdate={handleUpdateBalanceAccount}
        onDelete={handleDeleteBalanceAccount}
        submitting={submitting}
      />

      <CreateExpenseModal
        isOpen={showExpenseModal}
        onClose={() => {
          setShowExpenseModal(false);
          setEditingExpense(null);
        }}
        onSuccess={() => {
          loadData();
          setShowExpenseModal(false);
        }}
      />

      <ProductCostManager
        isOpen={showProductCostModal}
        onClose={() => setShowProductCostModal(false)}
        onSaved={() => {
          // Refresh patrimony data after updating costs
          loadData();
        }}
      />

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onTransferComplete={() => {
          loadData(true);
          setTransferRefreshTrigger((prev) => prev + 1);
        }}
      />
    </Layout>
  );
}
