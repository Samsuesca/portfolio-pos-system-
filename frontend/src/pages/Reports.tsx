/**
 * Reports Page - Refactored version using modular components
 *
 * Main orchestrator for the reports module with 6 tabs:
 * - Sales: Global sales summary, top products, top clients
 * - Financial: Transactions, expenses by category, cash flow
 * - Movements: Balance entries log
 * - Alterations: Alterations summary and list
 * - Inventory: Inventory movement logs
 * - Analysis: Monthly sales breakdown and trends
 */
import { useEffect, useState, useCallback } from 'react';
import Layout from '../components/Layout';
import { BarChart3, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

// Import report components
import {
  ReportHeader,
  REPORT_TAB_PERMISSIONS,
  SalesReport,
  OrdersReport,
  OverviewReport,
  FinancialReport,
  MovementsLog,
  AlterationsReport,
  InventoryLogs,
  MonthlySalesAnalysis,
  ProfitabilityReport,
  type ReportTab,
  type DatePreset,
  type DateFilters,
  type TransactionItem,
  type ExpenseCategory,
  type CashFlowReport,
  type BalanceEntry,
  type BalanceAccount,
  getPresetDates,
  parseApiError,
  formatDateDisplay
} from '../components/reports';

// Services
import {
  reportsService,
  type GlobalSalesSummary,
  type GlobalTopProduct,
  type GlobalTopClient,
  type MonthlySalesReport,
  type ProfitabilityBySchoolResponse,
  type OrdersSummary,
  type OrdersStatusFunnel,
  type OrdersOnTimeDelivery,
  type OrdersTopProduct,
  type OrdersTopClient,
  type StreamSummary,
  type StreamsBreakdownBySchool,
  type RevenueBasis,
} from '../services/reportsService';

// Persist last-visited tab so muscle memory wins after the first visit.
// Default = 'overview' (the new executive Resumen 360).
const REPORTS_TAB_STORAGE_KEY = 'reports.activeTab';
const VALID_TABS: ReportTab[] = [
  'overview', 'sales', 'orders', 'profitability', 'financial',
  'movements', 'alterations', 'inventory', 'analysis',
];
const getInitialTab = (): ReportTab => {
  if (typeof window === 'undefined') return 'overview';
  const stored = window.localStorage.getItem(REPORTS_TAB_STORAGE_KEY);
  if (stored && VALID_TABS.includes(stored as ReportTab)) return stored as ReportTab;
  return 'overview';
};
import { schoolService, type School } from '../services/schoolService';
import { globalAccountingService } from '../services/globalAccountingService';
import { alterationService } from '../services/alterationService';
import { inventoryLogService, type InventoryLog } from '../services/inventoryLogService';
import type {
  AlterationsSummary,
  AlterationListItem,
  AlterationsResponseTime,
  AlterationsTopType,
} from '../types/api';

// Stores
import { useSchoolStore } from '../stores/schoolStore';
import { useCurrentBranchId } from '../stores/branchStore';

export default function Reports() {
  const { availableSchools, loadSchools } = useSchoolStore();
  const { hasPermission } = usePermissions();
  // Sucursal seleccionada (v3.1). null = consolidado ⇒ no se filtra (igual que
  // hoy). Solo afecta a los reportes cuyos endpoints ya aceptan branch_id:
  // Resumen 360 (streams) y Encargos.
  const currentBranchId = useCurrentBranchId();

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Default = Resumen 360 (Fase 3); persists last-visited tab in localStorage.
  const [activeTab, setActiveTabState] = useState<ReportTab>(getInitialTab);
  const setActiveTab = useCallback((tab: ReportTab) => {
    setActiveTabState(tab);
    try {
      window.localStorage.setItem(REPORTS_TAB_STORAGE_KEY, tab);
    } catch {
      // localStorage unavailable (Safari private mode); silent ignore
    }
  }, []);

  // Keep activeTab on a tab the user can actually load. Sellers (and other
  // non-admin roles) lack reports.financial — the default Resumen tab — so fall
  // back to the first tab their permissions allow instead of 403-ing on mount.
  useEffect(() => {
    if (!hasPermission(REPORT_TAB_PERMISSIONS[activeTab])) {
      const firstAllowed = VALID_TABS.find((t) => hasPermission(REPORT_TAB_PERMISSIONS[t]));
      if (firstAllowed) setActiveTab(firstAllowed);
    }
  }, [hasPermission, activeTab, setActiveTab]);

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [activeFilters, setActiveFilters] = useState<DateFilters>(() => getPresetDates('month'));
  const [filtersReady, setFiltersReady] = useState(false);

  // School filters
  const [salesSchoolFilter, setSalesSchoolFilter] = useState<string>('');
  const [allSchools, setAllSchools] = useState<School[]>([]);

  // Sales data
  const [globalSalesSummary, setGlobalSalesSummary] = useState<GlobalSalesSummary | null>(null);
  const [globalTopProducts, setGlobalTopProducts] = useState<GlobalTopProduct[]>([]);
  const [globalTopClients, setGlobalTopClients] = useState<GlobalTopClient[]>([]);

  // Financial data
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseCategory[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);

  // Movements data
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [balanceEntries, setBalanceEntries] = useState<BalanceEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [balanceAccounts, setBalanceAccounts] = useState<BalanceAccount[]>([]);

  // Alterations data
  const [alterationsLoading, setAlterationsLoading] = useState(false);
  const [alterationsError, setAlterationsError] = useState<string | null>(null);
  const [alterationsSummary, setAlterationsSummary] = useState<AlterationsSummary | null>(null);
  const [alterationsList, setAlterationsList] = useState<AlterationListItem[]>([]);
  // Fase 2 (Reports Coverage) — operational KPIs for Arreglos tab
  const [alterationsResponseTime, setAlterationsResponseTime] = useState<AlterationsResponseTime | null>(null);
  const [alterationsTopTypes, setAlterationsTopTypes] = useState<AlterationsTopType[]>([]);

  // Inventory data
  const [inventoryLogsLoading, setInventoryLogsLoading] = useState(false);
  const [inventoryLogsError, setInventoryLogsError] = useState<string | null>(null);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [inventoryLogsTotal, setInventoryLogsTotal] = useState(0);
  const [inventorySchoolFilter, setInventorySchoolFilter] = useState<string>('');
  const [inventoryTypeFilter, setInventoryTypeFilter] = useState<string>('');

  // Analysis data
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlySalesReport | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Profitability data
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_profitabilityError, setProfitabilityError] = useState<string | null>(null);
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityBySchoolResponse | null>(null);

  // Orders (Encargos) data — Fase 1 del plan Reports Coverage
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersSummary, setOrdersSummary] = useState<OrdersSummary | null>(null);
  const [ordersFunnel, setOrdersFunnel] = useState<OrdersStatusFunnel | null>(null);
  const [ordersOnTime, setOrdersOnTime] = useState<OrdersOnTimeDelivery | null>(null);
  const [ordersTopProducts, setOrdersTopProducts] = useState<OrdersTopProduct[]>([]);
  const [ordersTopClients, setOrdersTopClients] = useState<OrdersTopClient[]>([]);
  const [ordersSchoolFilter, setOrdersSchoolFilter] = useState<string>('');

  // Overview (Resumen 360) data — Fase 3 del plan Reports Coverage
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewSummary, setOverviewSummary] = useState<StreamSummary | null>(null);
  const [overviewBySchool, setOverviewBySchool] = useState<StreamsBreakdownBySchool | null>(null);
  const [overviewBasis, setOverviewBasis] = useState<RevenueBasis>('accrual');

  // ============= DATA LOADING =============

  const loadGlobalSalesReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        ...activeFilters,
        schoolId: salesSchoolFilter || undefined
      };

      const [summaryData, productsData, clientsData] = await Promise.all([
        reportsService.getGlobalSalesSummary(filters),
        reportsService.getGlobalTopProducts(5, filters),
        reportsService.getGlobalTopClients(5, filters),
      ]);

      setGlobalSalesSummary(summaryData);
      setGlobalTopProducts(productsData);
      setGlobalTopClients(clientsData);
    } catch (err: any) {
      console.error('Error loading global sales reports:', err);
      setError(err.response?.data?.detail || 'Error al cargar los reportes de ventas');
    } finally {
      setLoading(false);
    }
  }, [activeFilters, salesSchoolFilter]);

  const loadFinancialReports = useCallback(async () => {
    try {
      setFinancialLoading(true);
      setFinancialError(null);

      const { startDate, endDate } = activeFilters;

      let groupBy: 'day' | 'week' | 'month' = 'day';
      if (startDate && endDate) {
        const daysDiff = Math.ceil(
          (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 90) groupBy = 'month';
        else if (daysDiff > 30) groupBy = 'week';
      }

      const [transactionsData, expensesData, cashFlowData] = await Promise.all([
        globalAccountingService.getGlobalTransactions({
          startDate,
          endDate,
          limit: 50
        }),
        globalAccountingService.getExpensesSummaryByCategory({
          startDate,
          endDate
        }),
        startDate && endDate
          ? globalAccountingService.getCashFlowReport(startDate, endDate, groupBy)
          : Promise.resolve(null)
      ]);

      setTransactions(transactionsData.items);
      setExpensesByCategory(expensesData.items);
      setCashFlow(cashFlowData);
    } catch (err: any) {
      const parsedError = parseApiError(err);
      console.error('[FinancialReportsError]', parsedError);
      setFinancialError(parsedError.userMessage);
    } finally {
      setFinancialLoading(false);
    }
  }, [activeFilters]);

  const loadMovementsLog = useCallback(async () => {
    try {
      setMovementsLoading(true);
      setMovementsError(null);

      const { startDate, endDate } = activeFilters;

      // Load balance accounts for filter dropdown (only once)
      if (balanceAccounts.length === 0) {
        const accountsResult = await globalAccountingService.getGlobalBalanceAccounts();
        const currentAssets = accountsResult.items.filter((a: any) => a.account_type === 'asset_current');
        setBalanceAccounts(currentAssets);
      }

      const response = await globalAccountingService.getUnifiedBalanceEntries({
        startDate,
        endDate,
        accountId: selectedAccountId || undefined,
        limit: 100
      });

      setBalanceEntries(response.items ?? []);
      setEntriesTotal(response.total ?? 0);
    } catch (err: any) {
      const parsedError = parseApiError(err);
      console.error('[MovementsLogError]', parsedError);
      setMovementsError(parsedError.userMessage);
    } finally {
      setMovementsLoading(false);
    }
  }, [activeFilters, selectedAccountId, balanceAccounts.length]);

  const loadAlterationsReport = useCallback(async () => {
    try {
      setAlterationsLoading(true);
      setAlterationsError(null);

      const { startDate, endDate } = activeFilters;

      // Fase 2 — Reports Coverage: getSummary now respects date filters so
      // the KPI cards stay in sync with the list (Bug 9 of the audit).
      // The new response-time + top-types endpoints power the new widgets
      // below the existing summary cards.
      const [summaryData, listData, responseTimeData, topTypesData] = await Promise.all([
        alterationService.getSummary({
          start_date: startDate,
          end_date: endDate,
        }),
        alterationService.getAll({
          start_date: startDate,
          end_date: endDate,
          limit: 50
        }),
        alterationService.getResponseTimeStats({
          start_date: startDate,
          end_date: endDate,
        }),
        alterationService.getTopTypes({
          start_date: startDate,
          end_date: endDate,
          limit: 5,
        }),
      ]);

      setAlterationsSummary(summaryData);
      setAlterationsList(listData.items);
      setAlterationsResponseTime(responseTimeData);
      setAlterationsTopTypes(topTypesData);
    } catch (err: any) {
      const parsedError = parseApiError(err);
      console.error('[AlterationsReportError]', parsedError);
      setAlterationsError(parsedError.userMessage);
    } finally {
      setAlterationsLoading(false);
    }
  }, [activeFilters]);

  const loadInventoryLogs = useCallback(async () => {
    if (!inventorySchoolFilter) {
      setInventoryLogs([]);
      setInventoryLogsTotal(0);
      return;
    }

    try {
      setInventoryLogsLoading(true);
      setInventoryLogsError(null);

      const { startDate, endDate } = activeFilters;

      const response = await inventoryLogService.getSchoolLogs(inventorySchoolFilter, {
        start_date: startDate,
        end_date: endDate,
        movement_type: inventoryTypeFilter || undefined,
        limit: 100
      });

      setInventoryLogs(response.items ?? []);
      setInventoryLogsTotal(response.total ?? 0);
    } catch (err: any) {
      const parsedError = parseApiError(err);
      console.error('[InventoryLogsError]', parsedError);
      setInventoryLogsError(parsedError.userMessage);
    } finally {
      setInventoryLogsLoading(false);
    }
  }, [activeFilters, inventorySchoolFilter, inventoryTypeFilter]);

  const loadAnalysisData = useCallback(async () => {
    try {
      setAnalysisLoading(true);
      setAnalysisError(null);

      const filters = {
        ...activeFilters,
        schoolId: salesSchoolFilter || undefined
      };

      const data = await reportsService.getMonthlySalesBreakdown(filters);
      setMonthlyData(data);
    } catch (err: any) {
      console.error('Error loading analysis data:', err);
      setAnalysisError(err.response?.data?.detail || 'Error al cargar el analisis mensual');
    } finally {
      setAnalysisLoading(false);
    }
  }, [activeFilters, salesSchoolFilter]);

  const loadProfitabilityData = useCallback(async () => {
    try {
      setProfitabilityLoading(true);
      setProfitabilityError(null);

      const data = await reportsService.getProfitabilityBySchool(activeFilters);
      setProfitabilityData(data);
    } catch (err: any) {
      console.error('Error loading profitability data:', err);
      setProfitabilityError(err.response?.data?.detail || 'Error al cargar rentabilidad');
    } finally {
      setProfitabilityLoading(false);
    }
  }, [activeFilters]);

  const loadOverviewReport = useCallback(async () => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);

      // streams-by-school agrupa por colegio y el backend no acepta branch_id
      // ahí — solo el summary se filtra por sucursal.
      const [summary, bySchool] = await Promise.all([
        reportsService.getStreamsSummary(
          { ...activeFilters, branchId: currentBranchId || undefined },
          overviewBasis,
        ),
        reportsService.getStreamsBreakdownBySchool(activeFilters, overviewBasis),
      ]);
      setOverviewSummary(summary);
      setOverviewBySchool(bySchool);
    } catch (err: any) {
      const parsedError = parseApiError(err);
      console.error('[OverviewReportError]', parsedError);
      setOverviewError(parsedError.userMessage);
    } finally {
      setOverviewLoading(false);
    }
  }, [activeFilters, overviewBasis, currentBranchId]);

  const loadOrdersReport = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);

      const filters = {
        ...activeFilters,
        schoolId: ordersSchoolFilter || undefined,
        branchId: currentBranchId || undefined,
      };

      const [summary, funnel, onTime, topProducts, topClients] = await Promise.all([
        reportsService.getOrdersSummary(filters),
        reportsService.getOrdersStatusFunnel(filters),
        reportsService.getOrdersOnTimeDelivery(filters),
        reportsService.getOrdersTopProducts(5, filters),
        reportsService.getOrdersTopClients(5, filters),
      ]);

      setOrdersSummary(summary);
      setOrdersFunnel(funnel);
      setOrdersOnTime(onTime);
      setOrdersTopProducts(topProducts);
      setOrdersTopClients(topClients);
    } catch (err: any) {
      const parsedError = parseApiError(err);
      console.error('[OrdersReportError]', parsedError);
      setOrdersError(parsedError.userMessage);
    } finally {
      setOrdersLoading(false);
    }
  }, [activeFilters, ordersSchoolFilter, currentBranchId]);

  // ============= EFFECTS =============

  useEffect(() => {
    const loadAllSchools = async () => {
      try {
        const schoolsResult = await schoolService.getSchools(false);
        setAllSchools(schoolsResult.items);
      } catch (err) {
        console.error('Error loading all schools:', err);
      }
    };
    loadAllSchools();
  }, []);

  useEffect(() => {
    if (availableSchools.length === 0) {
      loadSchools();
    }
  }, [availableSchools.length, loadSchools]);

  useEffect(() => {
    setFiltersReady(true);
  }, []);

  useEffect(() => {
    if (!filtersReady) return;
    // Don't fetch a tab the user can't load (would 403). The effect above
    // redirects activeTab to an accessible one.
    if (!hasPermission(REPORT_TAB_PERMISSIONS[activeTab])) return;

    if (Object.keys(activeFilters).length > 0 || datePreset === 'all') {
      switch (activeTab) {
        case 'overview':
          loadOverviewReport();
          break;
        case 'sales':
          loadGlobalSalesReports();
          break;
        case 'orders':
          loadOrdersReport();
          break;
        case 'financial':
          loadFinancialReports();
          break;
        case 'movements':
          loadMovementsLog();
          break;
        case 'alterations':
          loadAlterationsReport();
          break;
        case 'inventory':
          if (inventorySchoolFilter) {
            loadInventoryLogs();
          }
          break;
        case 'analysis':
          loadAnalysisData();
          break;
        case 'profitability':
          loadProfitabilityData();
          break;
      }
    }
  }, [
    activeFilters, activeTab, filtersReady, selectedAccountId,
    salesSchoolFilter, ordersSchoolFilter, overviewBasis,
    inventorySchoolFilter, inventoryTypeFilter, selectedMonth,
    loadOverviewReport, loadGlobalSalesReports, loadOrdersReport,
    loadFinancialReports, loadMovementsLog,
    loadAlterationsReport, loadInventoryLogs, loadAnalysisData, loadProfitabilityData,
    hasPermission
  ]);

  // ============= HANDLERS =============

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      const filters = getPresetDates(preset);
      setActiveFilters(filters);
    }
  };

  const handleApplyCustomDates = () => {
    if (customStartDate && customEndDate) {
      setActiveFilters({
        startDate: customStartDate,
        endDate: customEndDate
      });
    }
  };

  const getDateRangeLabel = (): string => {
    if (datePreset === 'all') return 'Todo el tiempo';
    if (!activeFilters.startDate || !activeFilters.endDate) return '';
    if (activeFilters.startDate === activeFilters.endDate) {
      return formatDateDisplay(activeFilters.startDate);
    }
    return `${formatDateDisplay(activeFilters.startDate)} - ${formatDateDisplay(activeFilters.endDate)}`;
  };

  const handleRefresh = () => {
    switch (activeTab) {
      case 'overview':
        loadOverviewReport();
        break;
      case 'sales':
        loadGlobalSalesReports();
        break;
      case 'orders':
        loadOrdersReport();
        break;
      case 'financial':
        loadFinancialReports();
        break;
      case 'movements':
        loadMovementsLog();
        break;
      case 'alterations':
        loadAlterationsReport();
        break;
      case 'inventory':
        loadInventoryLogs();
        break;
      case 'analysis':
        loadAnalysisData();
        break;
      case 'profitability':
        loadProfitabilityData();
        break;
    }
  };

  // ============= LOADING/ERROR STATES =============

  if (loading && activeTab === 'sales' && !globalSalesSummary) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
          <span className="ml-3 text-stone-600">Cargando reportes...</span>
        </div>
      </Layout>
    );
  }

  if (error && activeTab === 'sales') {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error al cargar reportes</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                onClick={loadGlobalSalesReports}
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
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-brand-600" />
            Reportes
          </h1>
          <p className="text-stone-600 mt-1">Resumen de metricas del negocio</p>
        </div>
        <button
          onClick={handleRefresh}
          className="bg-white border border-stone-200 text-stone-700 px-4 py-2 rounded-lg flex items-center hover:bg-stone-50 transition self-start"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Actualizar
        </button>
      </div>

      {/* Tab Navigation and Date Filters */}
      <ReportHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        datePreset={datePreset}
        onPresetChange={handlePresetChange}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        onCustomStartDateChange={setCustomStartDate}
        onCustomEndDateChange={setCustomEndDate}
        onApplyCustomDates={handleApplyCustomDates}
        activeFilters={activeFilters}
      />

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewReport
          loading={overviewLoading}
          error={overviewError}
          onRetry={loadOverviewReport}
          summary={overviewSummary}
          bySchool={overviewBySchool}
          basis={overviewBasis}
          onBasisChange={setOverviewBasis}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}

      {activeTab === 'sales' && (
        <SalesReport
          globalSalesSummary={globalSalesSummary}
          globalTopProducts={globalTopProducts}
          globalTopClients={globalTopClients}
          salesSchoolFilter={salesSchoolFilter}
          onSchoolFilterChange={setSalesSchoolFilter}
          allSchools={allSchools}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersReport
          loading={ordersLoading}
          error={ordersError}
          onRetry={loadOrdersReport}
          summary={ordersSummary}
          funnel={ordersFunnel}
          onTime={ordersOnTime}
          topProducts={ordersTopProducts}
          topClients={ordersTopClients}
          schoolFilter={ordersSchoolFilter}
          onSchoolFilterChange={setOrdersSchoolFilter}
          allSchools={allSchools}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}

      {activeTab === 'financial' && (
        <FinancialReport
          loading={financialLoading}
          error={financialError}
          onRetry={loadFinancialReports}
          transactions={transactions}
          expensesByCategory={expensesByCategory}
          cashFlow={cashFlow}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}

      {activeTab === 'movements' && (
        <MovementsLog
          loading={movementsLoading}
          error={movementsError}
          onRetry={loadMovementsLog}
          balanceEntries={balanceEntries}
          entriesTotal={entriesTotal}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
          balanceAccounts={balanceAccounts}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}

      {activeTab === 'alterations' && (
        <AlterationsReport
          loading={alterationsLoading}
          error={alterationsError}
          onRetry={loadAlterationsReport}
          alterationsSummary={alterationsSummary}
          alterationsList={alterationsList}
          responseTime={alterationsResponseTime}
          topTypes={alterationsTopTypes}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}

      {activeTab === 'inventory' && (
        <InventoryLogs
          loading={inventoryLogsLoading}
          error={inventoryLogsError}
          onRetry={loadInventoryLogs}
          inventoryLogs={inventoryLogs}
          inventoryLogsTotal={inventoryLogsTotal}
          inventorySchoolFilter={inventorySchoolFilter}
          onSchoolFilterChange={setInventorySchoolFilter}
          inventoryTypeFilter={inventoryTypeFilter}
          onTypeFilterChange={setInventoryTypeFilter}
          availableSchools={availableSchools}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}

      {activeTab === 'analysis' && (
        <MonthlySalesAnalysis
          loading={analysisLoading}
          error={analysisError}
          onRetry={loadAnalysisData}
          monthlyData={monthlyData}
          salesSchoolFilter={salesSchoolFilter}
          onSchoolFilterChange={setSalesSchoolFilter}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          allSchools={allSchools}
        />
      )}

      {activeTab === 'profitability' && (
        <ProfitabilityReport
          data={profitabilityData}
          loading={profitabilityLoading}
          dateRangeLabel={getDateRangeLabel()}
        />
      )}
    </Layout>
  );
}
