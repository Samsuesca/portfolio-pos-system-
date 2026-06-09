/**
 * Reports Service - API calls for reports and analytics
 */
import apiClient from '../utils/api-client';

export interface DashboardSummary {
  today: {
    sales_count: number;
    revenue: number;
  };
  this_month: {
    sales_count: number;
    revenue: number;
    average_ticket: number;
  };
  alerts: {
    low_stock_count: number;
    pending_orders_count: number;
  };
  inventory: {
    total_products: number;
    total_value: number;
  };
}

export interface DailySales {
  date: string;
  total_sales: number;
  total_revenue: number;
  completed_count: number;
  pending_count: number;
  cancelled_count: number;
  cash_sales: number;
  transfer_sales: number;
  card_sales: number;
  credit_sales: number;
}

export interface SalesSummary {
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
  sales_by_payment: Record<string, { count: number; total: number }>;
  start_date: string;
  end_date: string;
}

export interface TopProduct {
  product_id: string;
  product_code: string;
  product_name: string;
  product_size: string;
  units_sold: number;
  total_revenue: number;
}

export interface LowStockProduct {
  product_id: string;
  product_code: string;
  product_name: string;
  product_size: string;
  current_stock: number;
  min_stock: number;
}

export interface InventoryValue {
  total_products: number;
  total_units: number;
  total_value: number;
}

export interface PendingOrder {
  order_id: string;
  order_code: string;
  status: string;
  delivery_date: string | null;
  total: number;
  balance: number;
  created_at: string;
}

export interface TopClient {
  client_id: string;
  client_code: string;
  client_name: string;
  client_phone: string | null;
  total_purchases: number;
  total_spent: number;
}

// Global reports types
export interface GlobalSalesSummary {
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
  sales_by_payment: Record<string, { count: number; total: number }>;
  sales_by_school: Array<{
    school_id: string;
    school_name: string;
    sales_count: number;
    revenue: number;
  }>;
  start_date: string | null;
  end_date: string | null;
  school_id: string | null;
}

export interface SchoolProfitability {
  school_id: string;
  school_name: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin: number;
  products_with_cost: number;
  products_estimated: number;
  cost_coverage_percent: number;
}

export interface ProfitabilityBySchoolResponse {
  schools: SchoolProfitability[];
  totals: {
    revenue: number;
    cogs: number;
    gross_profit: number;
    gross_margin: number;
  };
  start_date: string | null;
  end_date: string | null;
}

export interface GlobalTopProduct {
  product_id: string;
  product_code: string;
  product_name: string;
  product_size: string;
  school_name: string;
  units_sold: number;
  total_revenue: number;
}

export interface GlobalTopClient {
  client_id: string;
  client_code: string;
  client_name: string;
  client_phone: string | null;
  school_name: string;
  total_purchases: number;
  total_spent: number;
}

export interface GlobalReportFilters extends DateFilters {
  schoolId?: string;  // Optional school filter
  // Sucursal física (v3.1). Filtro OPCIONAL: si se omite no se envía y el
  // reporte queda consolidado (todas las sucursales) — igual que hoy. Solo lo
  // consumen los endpoints de orders y revenue streams que ya lo aceptan en
  // el backend.
  branchId?: string;
}

// Date filter options for reports
export interface DateFilters {
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
}

// Monthly sales breakdown types
export interface MonthlySalesData {
  period: string;          // "2024-01"
  period_label: string;    // "Enero 2024"
  sales_count: number;
  total_revenue: number;
  average_ticket: number;
  by_payment: Record<string, { count: number; total: number }>;
}

// ============================================
// Orders (Encargos) — Fase 1 del plan Reports Coverage
// ============================================

export interface OrdersStatusCounts {
  pending: number;
  in_production: number;
  ready: number;
  delivered: number;
  cancelled: number;
}

export interface OrdersSummary {
  period_start: string | null;
  period_end: string | null;
  school_id: string | null;
  total_count: number;
  revenue_delivered: number;
  revenue_paid: number;
  balance_pending: number;
  avg_ticket: number | null;
  by_status: OrdersStatusCounts;
  delivered_count: number;
  cancelled_count: number;
}

export interface OrdersFunnelStep {
  status: string;
  label: string;
  count: number;
}

export interface OrdersStatusFunnel {
  period_start: string | null;
  period_end: string | null;
  school_id: string | null;
  steps: OrdersFunnelStep[];
}

export interface OrdersOnTimeDelivery {
  period_start: string | null;
  period_end: string | null;
  school_id: string | null;
  delivered_count: number;
  on_time_count: number;
  late_count: number;
  on_time_pct: number | null;
  avg_lead_time_days: number | null;
  oldest_pending_days: number;
}

export interface OrdersCumplimientoRow {
  school_id: string;
  school_name: string;
  overdue_count: number;
  avg_days_late: number;
  oldest_overdue_days: number;
}

export interface OrdersProfitabilityRow {
  school_id: string;
  school_name: string;
  revenue: number;
  /** Null when caller lacks `reports.cost_visibility` permission. */
  cogs: number | null;
  gross_profit: number | null;
  gross_margin: number | null;
  units_with_cost: number;
  units_estimated: number;
  cost_coverage_percent: number;
}

export interface OrdersProfitabilityResponse {
  period_start: string | null;
  period_end: string | null;
  schools: OrdersProfitabilityRow[];
  totals: {
    revenue: number;
    cogs: number | null;
    gross_profit: number | null;
    gross_margin: number | null;
  };
}

export interface OrdersTopProduct {
  product_id: string | null;
  product_code: string | null;
  product_name: string;
  product_size: string | null;
  school_name: string | null;
  units_ordered: number;
  total_revenue: number;
}

export interface OrdersTopClient {
  client_id: string;
  client_code: string;
  client_name: string;
  client_phone: string | null;
  school_name: string | null;
  total_orders: number;
  total_spent: number;
  total_pending: number;
}

// ============================================
// Unified Revenue Streams — Fase 3 del plan Reports Coverage
// ============================================

export type RevenueStreamId =
  | 'sales'
  | 'orders'
  | 'alterations'
  | 'b2b_contracts'
  | 'saas';

export type RevenueBasis = 'cash' | 'accrual';

export interface StreamBreakdown {
  revenue: number;
  /** Null when caller lacks `reports.cost_visibility`. */
  cogs: number | null;
  gross_profit: number | null;
  gross_margin_pct: number | null;
  count: number;
  /** Optional free-form note (e.g. 'not_yet_implemented' for B2B stub). */
  note: string | null;
}

export interface StreamSummary {
  period_start: string | null;
  period_end: string | null;
  school_id: string | null;
  branch_id: string | null;
  basis: RevenueBasis;
  streams: Partial<Record<RevenueStreamId, StreamBreakdown>>;
  totals: StreamBreakdown;
}

export interface StreamMonthlyPoint {
  period: string;        // YYYY-MM
  period_label: string;  // "Enero 2026"
  streams: Partial<Record<RevenueStreamId, StreamBreakdown>>;
}

export interface StreamMonthlyReport {
  period_start: string | null;
  period_end: string | null;
  school_id: string | null;
  branch_id: string | null;
  basis: RevenueBasis;
  months: StreamMonthlyPoint[];
  totals: Partial<Record<RevenueStreamId, StreamBreakdown>>;
  grand_total: StreamBreakdown;
}

export interface StreamsSchoolBreakdownRow {
  school_id: string;
  school_name: string;
  sales_revenue: number;
  orders_revenue: number;
  alterations_revenue: number;
  total_revenue: number;
}

export interface StreamsBreakdownBySchool {
  period_start: string | null;
  period_end: string | null;
  basis: RevenueBasis;
  rows: StreamsSchoolBreakdownRow[];
  totals: StreamsSchoolBreakdownRow;
}

export interface MonthlySalesReport {
  months: MonthlySalesData[];
  totals: {
    sales_count: number;
    total_revenue: number;
    average_ticket: number;
  };
  start_date: string;
  end_date: string;
  school_id: string | null;
}

export const reportsService = {
  /**
   * Get dashboard summary (with optional date filters)
   */
  async getDashboardSummary(schoolId: string, filters?: DateFilters): Promise<DashboardSummary> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<DashboardSummary>(`/schools/${schoolId}/reports/dashboard`, { params });
    return response.data;
  },

  /**
   * Get daily sales
   */
  async getDailySales(schoolId: string, date?: string): Promise<DailySales> {
    const params = date ? { target_date: date } : {};
    const response = await apiClient.get<DailySales>(`/schools/${schoolId}/reports/sales/daily`, { params });
    return response.data;
  },

  /**
   * Get sales summary for a period
   */
  async getSalesSummary(schoolId: string, filters?: DateFilters): Promise<SalesSummary> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<SalesSummary>(`/schools/${schoolId}/reports/sales/summary`, { params });
    return response.data;
  },

  /**
   * Get top selling products (with optional date filters)
   */
  async getTopProducts(schoolId: string, limit = 10, filters?: DateFilters): Promise<TopProduct[]> {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<TopProduct[]>(`/schools/${schoolId}/reports/sales/top-products`, { params });
    return response.data;
  },

  /**
   * Get low stock products
   */
  async getLowStock(schoolId: string, threshold = 5): Promise<LowStockProduct[]> {
    const response = await apiClient.get<LowStockProduct[]>(`/schools/${schoolId}/reports/inventory/low-stock`, {
      params: { threshold }
    });
    return response.data;
  },

  /**
   * Get inventory value
   */
  async getInventoryValue(schoolId: string): Promise<InventoryValue> {
    const response = await apiClient.get<InventoryValue>(`/schools/${schoolId}/reports/inventory/value`);
    return response.data;
  },

  /**
   * Get pending orders
   */
  async getPendingOrders(schoolId: string): Promise<PendingOrder[]> {
    const response = await apiClient.get<PendingOrder[]>(`/schools/${schoolId}/reports/orders/pending`);
    return response.data;
  },

  /**
   * Get top clients (with optional date filters)
   */
  async getTopClients(schoolId: string, limit = 10, filters?: DateFilters): Promise<TopClient[]> {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<TopClient[]>(`/schools/${schoolId}/reports/clients/top`, { params });
    return response.data;
  },

  // ============================================
  // Global Reports (across all schools)
  // ============================================

  /**
   * Get global sales summary across all schools (with optional school filter)
   */
  async getGlobalSalesSummary(filters?: GlobalReportFilters): Promise<GlobalSalesSummary> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<GlobalSalesSummary>('/global/reports/sales/summary', { params });
    return response.data;
  },

  /**
   * Get top selling products globally (with optional school filter)
   */
  async getGlobalTopProducts(limit = 10, filters?: GlobalReportFilters): Promise<GlobalTopProduct[]> {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<GlobalTopProduct[]>('/global/reports/sales/top-products', { params });
    return response.data;
  },

  /**
   * Get top clients globally (with optional school filter)
   */
  async getGlobalTopClients(limit = 10, filters?: GlobalReportFilters): Promise<GlobalTopClient[]> {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<GlobalTopClient[]>('/global/reports/sales/top-clients', { params });
    return response.data;
  },

  /**
   * Get monthly sales breakdown for trend analysis
   * Returns sales aggregated by month with totals and payment breakdown
   */
  async getMonthlySalesBreakdown(filters?: GlobalReportFilters): Promise<MonthlySalesReport> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<MonthlySalesReport>('/global/reports/sales/monthly', { params });
    return response.data;
  },

  /**
   * Get profitability metrics by school
   * Includes revenue, COGS, gross profit, and margin per school
   */
  async getProfitabilityBySchool(filters?: GlobalReportFilters): Promise<ProfitabilityBySchoolResponse> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<ProfitabilityBySchoolResponse>('/global/reports/profitability/by-school', { params });
    return response.data;
  },

  // ============================================
  // Orders (Encargos) — Fase 1 del plan Reports Coverage
  // Endpoints under /global/reports/orders/*
  // ============================================

  async getOrdersSummary(filters?: GlobalReportFilters): Promise<OrdersSummary> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    if (filters?.branchId) params.branch_id = filters.branchId;
    const response = await apiClient.get<OrdersSummary>('/global/reports/orders/summary', { params });
    return response.data;
  },

  async getOrdersStatusFunnel(filters?: GlobalReportFilters): Promise<OrdersStatusFunnel> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    if (filters?.branchId) params.branch_id = filters.branchId;
    const response = await apiClient.get<OrdersStatusFunnel>('/global/reports/orders/status-funnel', { params });
    return response.data;
  },

  async getOrdersOnTimeDelivery(filters?: GlobalReportFilters): Promise<OrdersOnTimeDelivery> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    if (filters?.branchId) params.branch_id = filters.branchId;
    const response = await apiClient.get<OrdersOnTimeDelivery>('/global/reports/orders/on-time-delivery', { params });
    return response.data;
  },

  /**
   * Overdue orders by school. No date filters — always "as of today".
   * @param overdueThresholdDays tolerance (0 = anything past delivery_date counts).
   */
  async getOrdersCumplimiento(
    schoolId?: string,
    overdueThresholdDays: number = 0,
    branchId?: string
  ): Promise<OrdersCumplimientoRow[]> {
    const params: Record<string, string | number> = { overdue_threshold_days: overdueThresholdDays };
    if (schoolId) params.school_id = schoolId;
    if (branchId) params.branch_id = branchId;
    const response = await apiClient.get<OrdersCumplimientoRow[]>('/global/reports/orders/cumplimiento', { params });
    return response.data;
  },

  async getOrdersTopProducts(limit = 5, filters?: GlobalReportFilters): Promise<OrdersTopProduct[]> {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    if (filters?.branchId) params.branch_id = filters.branchId;
    const response = await apiClient.get<OrdersTopProduct[]>('/global/reports/orders/top-products', { params });
    return response.data;
  },

  async getOrdersTopClients(limit = 5, filters?: GlobalReportFilters): Promise<OrdersTopClient[]> {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    if (filters?.branchId) params.branch_id = filters.branchId;
    const response = await apiClient.get<OrdersTopClient[]>('/global/reports/orders/top-clients', { params });
    return response.data;
  },

  /**
   * Orders profitability by school.
   * COGS/margin fields will be null if the caller lacks `reports.cost_visibility`.
   */
  async getOrdersProfitabilityBySchool(filters?: GlobalReportFilters): Promise<OrdersProfitabilityResponse> {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.branchId) params.branch_id = filters.branchId;
    const response = await apiClient.get<OrdersProfitabilityResponse>('/global/reports/orders/profitability/by-school', { params });
    return response.data;
  },

  // ============================================
  // Unified Revenue Streams — Fase 3 del plan Reports Coverage
  // Endpoints under /global/reports/revenue/*
  // ============================================

  async getStreamsSummary(
    filters?: GlobalReportFilters,
    basis: RevenueBasis = 'accrual',
    streams?: RevenueStreamId[],
  ): Promise<StreamSummary> {
    const params: Record<string, string | string[]> = { basis };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    if (filters?.branchId) params.branch_id = filters.branchId;
    if (streams && streams.length > 0) params.streams = streams;
    const response = await apiClient.get<StreamSummary>('/global/reports/revenue/streams-summary', { params });
    return response.data;
  },

  async getStreamsMonthly(
    startDate: string,
    endDate: string,
    options?: { basis?: RevenueBasis; schoolId?: string; branchId?: string; streams?: RevenueStreamId[] },
  ): Promise<StreamMonthlyReport> {
    const params: Record<string, string | string[]> = {
      start_date: startDate,
      end_date: endDate,
      basis: options?.basis ?? 'accrual',
    };
    if (options?.schoolId) params.school_id = options.schoolId;
    if (options?.branchId) params.branch_id = options.branchId;
    if (options?.streams && options.streams.length > 0) params.streams = options.streams;
    const response = await apiClient.get<StreamMonthlyReport>('/global/reports/revenue/streams-monthly', { params });
    return response.data;
  },

  async getStreamsBreakdownBySchool(
    filters?: GlobalReportFilters,
    basis: RevenueBasis = 'accrual',
  ): Promise<StreamsBreakdownBySchool> {
    const params: Record<string, string> = { basis };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<StreamsBreakdownBySchool>('/global/reports/revenue/streams-by-school', { params });
    return response.data;
  },
};
