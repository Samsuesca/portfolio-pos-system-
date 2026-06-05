/**
 * Projection Service - Multi-month financial projection API client.
 *
 * Endpoints under /global/accounting/projections/.
 * Mirrors backend schemas in app/schemas/financial_model.py (Module 8).
 */
import { apiClient } from '../utils/api-client';

const BASE = '/global/accounting/projections';

// ============================================
// Types — mirror of backend Pydantic schemas
// ============================================

export interface ProjectionHire {
  month_offset: number;
  /** Last month (inclusive, 0-indexed) where this hire is active. null = indefinite. */
  end_month_offset: number | null;
  role: string;
  monthly_salary: number;
  parafiscales_pct: number;
}

export interface ProjectionDebt {
  name: string;
  capital: number;
  monthly_payment: number;
  interest_portion_monthly: number;
  capital_portion_monthly: number;
  starts_month_offset: number;
  term_months: number | null;
}

export interface ProjectionNewBranch {
  month_offset: number;
  name: string;
  fixed_costs_monthly: number;
  payroll_monthly: number;
  revenue_ramp: number[];
}

export interface FormalizationOneTimeCost {
  month_offset: number;
  concept: string;
  amount: number;
}

export interface FormalizationRecurringCost {
  concept: string;
  amount_monthly: number;
  starts_month_offset: number;
  ends_month_offset: number | null;
}

export interface ProjectionFormalizationLayer {
  scenario_label: 'A' | 'B' | 'C' | 'custom';
  one_time_costs: FormalizationOneTimeCost[];
  recurring_costs: FormalizationRecurringCost[];
}

export interface ProjectionAssumptions {
  name: string;
  start_year: number;
  start_month: number;
  months: number;

  base_revenue_monthly: number;
  seasonality: Record<number, number>;
  growth_rate_monthly: number;

  cogs_pct: number;

  fixed_costs_monthly: number;

  payroll_monthly_base: number;
  hiring_plan: ProjectionHire[];

  new_branches: ProjectionNewBranch[];

  debts: ProjectionDebt[];

  formalization_layer: ProjectionFormalizationLayer | null;

  inflation_annual: number;
  initial_cash: number;
}

export interface ProjectionMonth {
  year: number;
  month: number;
  period_label: string;

  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;

  fixed_costs: number;
  payroll: number;
  formalization_cost_one_time: number;
  formalization_cost_recurring: number;
  total_opex: number;

  operating_profit: number;
  operating_margin_pct: number;

  interest_expense: number;
  debt_capital_payment: number;

  net_profit: number;
  net_margin_pct: number;

  cash_inflow: number;
  cash_outflow: number;
  net_cash_flow: number;
  cumulative_cash: number;

  headcount: number;

  below_breakeven: boolean;
  cash_negative: boolean;
}

export interface ProjectionSummary {
  total_revenue: number;
  total_cogs: number;
  total_gross_profit: number;
  avg_gross_margin_pct: number;

  total_opex: number;
  total_formalization_one_time: number;
  total_formalization_recurring: number;

  total_operating_profit: number;
  avg_operating_margin_pct: number;

  total_interest_expense: number;
  total_debt_capital_paid: number;

  total_net_profit: number;
  avg_net_margin_pct: number;

  ending_cash: number;
  min_cash: number;
  months_cash_negative: number;
  months_below_breakeven: number;

  breakeven_revenue_monthly_avg: number;
}

export interface ProjectionRunResponse {
  id: string | null;
  name: string;
  assumptions: ProjectionAssumptions;
  months: ProjectionMonth[];
  summary: ProjectionSummary;
  generated_at: string;
}

export interface ProjectionListItem {
  id: string;
  name: string;
  scenario_label: string | null;
  months_count: number;
  start_year: number;
  start_month: number;
  summary: ProjectionSummary;
  created_at: string;
}

export interface ProjectionDetailResponse {
  id: string;
  name: string;
  scenario_label: string | null;
  months_count: number;
  start_year: number;
  start_month: number;
  assumptions: ProjectionAssumptions;
  results: ProjectionMonth[];
  summary: ProjectionSummary;
  created_at: string;
}

// ============================================
// Decimal coercion
// ============================================
//
// Backend serializes Pydantic `Decimal` fields as JSON strings (not numbers).
// Our TS types declare them as `number`, so we coerce at the network boundary
// to honor the type contract. Without this, `+` concatenates strings, `===`
// fails between string and number (breaks the comparison highlight in
// ProjectionsList), and any `.toFixed()` would crash.

const SUMMARY_DECIMAL_FIELDS = [
  'total_revenue', 'total_cogs', 'total_gross_profit',
  'total_opex', 'total_formalization_one_time', 'total_formalization_recurring',
  'total_operating_profit', 'total_interest_expense', 'total_debt_capital_paid',
  'total_net_profit', 'ending_cash', 'min_cash', 'breakeven_revenue_monthly_avg',
] as const satisfies readonly (keyof ProjectionSummary)[];

const MONTH_DECIMAL_FIELDS = [
  'revenue', 'cogs', 'gross_profit',
  'fixed_costs', 'payroll', 'formalization_cost_one_time',
  'formalization_cost_recurring', 'total_opex',
  'operating_profit', 'interest_expense', 'debt_capital_payment',
  'net_profit', 'cash_inflow', 'cash_outflow', 'net_cash_flow',
  'cumulative_cash',
] as const satisfies readonly (keyof ProjectionMonth)[];

function coerceFields<T extends object, K extends keyof T>(obj: T, fields: readonly K[]): T {
  const out = { ...obj };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === 'string') {
      (out as Record<K, unknown>)[f] = Number(v) as T[K];
    }
  }
  return out;
}

function coerceSummary(s: ProjectionSummary): ProjectionSummary {
  return coerceFields(s, SUMMARY_DECIMAL_FIELDS);
}

function coerceMonth(m: ProjectionMonth): ProjectionMonth {
  return coerceFields(m, MONTH_DECIMAL_FIELDS);
}

function coerceRunResponse(r: ProjectionRunResponse): ProjectionRunResponse {
  return {
    ...r,
    months: r.months.map(coerceMonth),
    summary: coerceSummary(r.summary),
  };
}

function coerceListItem(it: ProjectionListItem): ProjectionListItem {
  return { ...it, summary: coerceSummary(it.summary) };
}

function coerceDetailResponse(d: ProjectionDetailResponse): ProjectionDetailResponse {
  return {
    ...d,
    results: d.results.map(coerceMonth),
    summary: coerceSummary(d.summary),
  };
}

// ============================================
// API methods
// ============================================

async function runProjection(
  assumptions: ProjectionAssumptions,
  options?: { persist?: boolean }
): Promise<ProjectionRunResponse> {
  const persist = options?.persist ?? true;
  const response = await apiClient.post<ProjectionRunResponse>(
    `${BASE}/run`,
    assumptions,
    { params: { persist } }
  );
  return coerceRunResponse(response.data);
}

async function listProjections(
  params?: { limit?: number; scenario?: string }
): Promise<ProjectionListItem[]> {
  const response = await apiClient.get<ProjectionListItem[]>(BASE, { params });
  return response.data.map(coerceListItem);
}

async function getProjection(id: string): Promise<ProjectionDetailResponse> {
  const response = await apiClient.get<ProjectionDetailResponse>(`${BASE}/${id}`);
  return coerceDetailResponse(response.data);
}

async function deleteProjection(id: string): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export const projectionService = {
  runProjection,
  listProjections,
  getProjection,
  deleteProjection,
};

export default projectionService;
