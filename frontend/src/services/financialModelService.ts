/**
 * Financial Model Service - API client for financial analysis endpoints
 *
 * All endpoints under /global/accounting/financial-model/
 */
import { apiClient } from '../utils/api-client';

const BASE = '/global/accounting/financial-model';

// ============================================
// Types
// ============================================

export interface KPIValue {
  key: string;
  label: string;
  value: number;
  formatted_value: string;
  unit: string;
  trend: number[];
  trend_labels: string[];
  status: 'good' | 'caution' | 'critical' | 'neutral';
  tooltip: string;
}

export interface KPIDashboardResponse {
  period: string;
  generated_at: string;
  kpis: KPIValue[];
}

export interface SchoolProfitability {
  school_id: string;
  school_name: string;
  revenue: number;
  cost_of_goods: number;
  direct_expenses: number;
  contribution_margin: number;
  margin_percentage: number;
  revenue_share: number;
  monthly_trend: { month: string; label: string; revenue: number }[];
}

export interface ProfitabilityResponse {
  start_date: string;
  end_date: string;
  total_revenue: number;
  schools: SchoolProfitability[];
}

export interface TrendDataPoint {
  period: string;
  period_label: string;
  value: number;
}

export interface TrendSeries {
  metric: string;
  label: string;
  data: TrendDataPoint[];
  growth_rate: number | null;
  moving_avg_3m: number[];
  moving_avg_6m: number[];
}

export interface TrendAnalysisResponse {
  start_date: string;
  end_date: string;
  period: string;
  series: TrendSeries[];
  anomalies: {
    metric: string;
    period: string;
    value: number;
    z_score: number;
    direction: string;
  }[];
}

export interface BudgetItem {
  id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  category: string;
  school_id: string | null;
  budgeted_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetCreate {
  period_type: string;
  period_start: string;
  period_end: string;
  category: string;
  school_id?: string | null;
  budgeted_amount: number;
  notes?: string | null;
}

export interface BudgetVsActualItem {
  category: string;
  category_label: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_percentage: number;
  status: 'within' | 'near_limit' | 'over';
}

export interface BudgetVsActualResponse {
  period_type: string;
  period_start: string;
  period_end: string;
  items: BudgetVsActualItem[];
  total_budgeted: number;
  total_actual: number;
  total_variance: number;
}

export interface ForecastPeriod {
  period: string;
  period_label: string;
  projected_income: number;
  projected_expenses: number;
  projected_net: number;
  projected_balance: number;
}

export interface CashForecastScenario {
  name: string;
  label: string;
  periods: ForecastPeriod[];
}

export interface CashForecastResponse {
  current_balance: number;
  min_threshold: number;
  runway_months: number;
  scenarios: CashForecastScenario[];
}

export interface FinancialAlert {
  alert_type: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  metric_value: string;
  threshold: string;
  recommendation: string;
}

export interface HealthAlertsResponse {
  generated_at: string;
  alerts: FinancialAlert[];
  critical_count: number;
  warning_count: number;
  info_count: number;
}

export interface TopItem {
  name: string;
  amount: number;
  percentage: number;
}

export interface ExecutiveSummaryResponse {
  period: string;
  period_label: string;
  generated_at: string;
  revenue: number;
  expenses: number;
  net_profit: number;
  cash_position: number;
  revenue_vs_previous: number | null;
  expenses_vs_previous: number | null;
  profit_vs_previous: number | null;
  top_schools: TopItem[];
  top_expense_categories: TopItem[];
  kpi_snapshot: KPIValue[];
  active_alerts: FinancialAlert[];
  forecast_summary: string;
}

// ============================================
// API Methods
// ============================================

async function getKPIs(params?: {
  period?: string;
  months?: number;
  school_id?: string;
}): Promise<KPIDashboardResponse> {
  const response = await apiClient.get<KPIDashboardResponse>(
    `${BASE}/kpis`, { params }
  );
  return response.data;
}

async function getProfitabilityBySchool(params?: {
  start_date?: string;
  end_date?: string;
  school_ids?: string;
}): Promise<ProfitabilityResponse> {
  const response = await apiClient.get<ProfitabilityResponse>(
    `${BASE}/profitability/by-school`, { params }
  );
  return response.data;
}

async function getTrends(params?: {
  metrics?: string;
  period?: string;
  start_date?: string;
  end_date?: string;
}): Promise<TrendAnalysisResponse> {
  const response = await apiClient.get<TrendAnalysisResponse>(
    `${BASE}/trends`, { params }
  );
  return response.data;
}

async function getBudgets(params?: {
  period_type?: string;
  period_start?: string;
}): Promise<BudgetItem[]> {
  const response = await apiClient.get<BudgetItem[]>(
    `${BASE}/budgets`, { params }
  );
  return response.data;
}

async function createBudget(data: BudgetCreate): Promise<BudgetItem> {
  const response = await apiClient.post<BudgetItem>(
    `${BASE}/budgets`, data
  );
  return response.data;
}

async function deleteBudget(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/budgets/${id}`);
}

async function getBudgetVsActual(params: {
  period_type: string;
  period_start: string;
}): Promise<BudgetVsActualResponse> {
  const response = await apiClient.get<BudgetVsActualResponse>(
    `${BASE}/budget-vs-actual`, { params }
  );
  return response.data;
}

async function getCashForecast(params?: {
  weeks?: number;
  months?: number;
  min_threshold?: number;
}): Promise<CashForecastResponse> {
  const response = await apiClient.get<CashForecastResponse>(
    `${BASE}/cash-forecast`, { params }
  );
  return response.data;
}

async function getHealthAlerts(): Promise<HealthAlertsResponse> {
  const response = await apiClient.get<HealthAlertsResponse>(
    `${BASE}/health-alerts`
  );
  return response.data;
}

async function getExecutiveSummary(params?: {
  period?: string;
}): Promise<ExecutiveSummaryResponse> {
  const response = await apiClient.get<ExecutiveSummaryResponse>(
    `${BASE}/executive-summary`, { params }
  );
  return response.data;
}

// ============================================
// Export
// ============================================

export const financialModelService = {
  getKPIs,
  getProfitabilityBySchool,
  getTrends,
  getBudgets,
  createBudget,
  deleteBudget,
  getBudgetVsActual,
  getCashForecast,
  getHealthAlerts,
  getExecutiveSummary,
};

export default financialModelService;
