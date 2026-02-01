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

// Import report components
import {
  ReportHeader,
  SalesReport,
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
import { reportsService, type GlobalSalesSummary, type GlobalTopProduct, type GlobalTopClient, type MonthlySalesReport, type ProfitabilityBySchoolResponse } from '../services/reportsService';
import { schoolService, type School } from '../services/schoolService';
import { globalAccountingService } from '../services/globalAccountingService';
import { alterationService } from '../services/alterationService';
import { inventoryLogService, type InventoryLog } from '../services/inventoryLogService';
import type { AlterationsSummary, AlterationListItem } from '../types/api';

// Stores
import { useSchoolStore } from '../stores/schoolStore';

export default function Reports() {
  const { availableSchools, loadSchools } = useSchoolStore();

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('sales');

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

      setTransactions(transactionsData);
      setExpensesByCategory(expensesData);
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
        const accounts = await globalAccountingService.getGlobalBalanceAccounts();
        const currentAssets = accounts.filter((a: any) => a.account_type === 'asset_current');
        setBalanceAccounts(currentAssets);
      }

      const response = await globalAccountingService.getUnifiedBalanceEntries({
        startDate,
        endDate,
        accountId: selectedAccountId || undefined,
        limit: 100
      });

      setBalanceEntries(response.items);
      setEntriesTotal(response.total);
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

      const [summaryData, listData] = await Promise.all([
        alterationService.getSummary(),
        alterationService.getAll({
          start_date: startDate,
          end_date: endDate,
          limit: 50
        })
      ]);

      setAlterationsSummary(summaryData);
      setAlterationsList(listData);
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

      setInventoryLogs(response.items);
      setInventoryLogsTotal(response.total);
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

  // ============= EFFECTS =============

  useEffect(() => {
    const loadAllSchools = async () => {
      try {
        const schools = await schoolService.getSchools(false);
        setAllSchools(schools);
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

    if (Object.keys(activeFilters).length > 0 || datePreset === 'all') {
      switch (activeTab) {
        case 'sales':
          loadGlobalSalesReports();
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
    salesSchoolFilter, inventorySchoolFilter, inventoryTypeFilter, selectedMonth,
    loadGlobalSalesReports, loadFinancialReports, loadMovementsLog,
    loadAlterationsReport, loadInventoryLogs, loadAnalysisData, loadProfitabilityData
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
      case 'sales':
        loadGlobalSalesReports();
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
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Cargando reportes...</span>
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
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-blue-600" />
            Reportes
          </h1>
          <p className="text-gray-600 mt-1">Resumen de metricas del negocio</p>
        </div>
        <button
          onClick={handleRefresh}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center hover:bg-gray-50 transition self-start"
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
