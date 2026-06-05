/**
 * Cost Insights Service — endpoints agregados del módulo de costos.
 * Todos gated por `inventory.view_cost` en backend.
 */
import { apiClient } from '../utils/api-client';

export interface CostInsightsSummary {
  total_active_products: number;
  manufactured_total: number;
  purchased_total: number;
  products_with_cost: number;
  products_without_cost: number;
  coverage_percent: number;
  avg_cost: number | null;
  avg_price: number | null;
  avg_margin_percent: number | null;
  underwater_count: number;
}

export interface SchoolCostBreakdown {
  school_id: string | null;
  school_code: string;
  school_name: string;
  products_total: number;
  products_with_cost: number;
  coverage_percent: number;
  avg_cost: number | null;
  avg_margin_percent: number | null;
  underwater_count: number;
}

export interface TopMarginProduct {
  product_id: string;
  code: string;
  name: string | null;
  size: string;
  school_id: string | null;
  school_name: string | null;
  garment_type_name: string | null;
  price: number;
  cost: number;
  margin: number;
  margin_percent: number;
}

export interface ComponentDistribution {
  template_code: string;
  template_name: string;
  total_amount: number;
  percent_of_total: number;
}

const BASE = '/global/cost-insights';

export const getSummary = async (): Promise<CostInsightsSummary> => {
  const { data } = await apiClient.get<CostInsightsSummary>(`${BASE}/summary`);
  return data;
};

export const getBySchool = async (): Promise<SchoolCostBreakdown[]> => {
  const { data } = await apiClient.get<SchoolCostBreakdown[]>(`${BASE}/by-school`);
  return data;
};

export const getTopMargin = async (
  direction: 'best' | 'worst' = 'best',
  limit: number = 10,
): Promise<TopMarginProduct[]> => {
  const { data } = await apiClient.get<TopMarginProduct[]>(
    `${BASE}/top-margin?direction=${direction}&limit=${limit}`,
  );
  return data;
};

export const getComponentDistribution = async (): Promise<ComponentDistribution[]> => {
  const { data } = await apiClient.get<ComponentDistribution[]>(`${BASE}/component-distribution`);
  return data;
};
