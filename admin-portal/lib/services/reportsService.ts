/**
 * Reports Service - API calls for reports and analytics
 */
import apiClient from '../api';

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

// Date filter options for reports
export interface DateFilters {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface GlobalReportFilters extends DateFilters {
  schoolId?: string;
}

// Monthly sales breakdown types
export interface MonthlySalesData {
  period: string;
  period_label: string;
  sales_count: number;
  total_revenue: number;
  average_ticket: number;
  by_payment: Record<string, { count: number; total: number }>;
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

// Cash flow types
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

// Expense category types
export interface ExpenseCategory {
  category: string;
  category_label: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  count: number;
  percentage: number;
}

const reportsService = {
  // School-specific reports
  getDashboardSummary: async (
    schoolId: string,
    filters?: DateFilters
  ): Promise<DashboardSummary> => {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<DashboardSummary>(
      `/schools/${schoolId}/reports/dashboard`,
      { params }
    );
    return response.data;
  },

  getSalesSummary: async (
    schoolId: string,
    filters?: DateFilters
  ): Promise<SalesSummary> => {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<SalesSummary>(
      `/schools/${schoolId}/reports/sales/summary`,
      { params }
    );
    return response.data;
  },

  getTopProducts: async (
    schoolId: string,
    limit = 10,
    filters?: DateFilters
  ): Promise<TopProduct[]> => {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<TopProduct[]>(
      `/schools/${schoolId}/reports/sales/top-products`,
      { params }
    );
    return response.data;
  },

  getLowStock: async (
    schoolId: string,
    threshold = 5
  ): Promise<LowStockProduct[]> => {
    const response = await apiClient.get<LowStockProduct[]>(
      `/schools/${schoolId}/reports/inventory/low-stock`,
      { params: { threshold } }
    );
    return response.data;
  },

  getTopClients: async (
    schoolId: string,
    limit = 10,
    filters?: DateFilters
  ): Promise<TopClient[]> => {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<TopClient[]>(
      `/schools/${schoolId}/reports/clients/top`,
      { params }
    );
    return response.data;
  },

  // Global reports
  getGlobalSalesSummary: async (
    filters?: GlobalReportFilters
  ): Promise<GlobalSalesSummary> => {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<GlobalSalesSummary>(
      '/global/reports/sales/summary',
      { params }
    );
    return response.data;
  },

  getGlobalTopProducts: async (
    limit = 10,
    filters?: GlobalReportFilters
  ): Promise<GlobalTopProduct[]> => {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<GlobalTopProduct[]>(
      '/global/reports/sales/top-products',
      { params }
    );
    return response.data;
  },

  getGlobalTopClients: async (
    limit = 10,
    filters?: GlobalReportFilters
  ): Promise<GlobalTopClient[]> => {
    const params: Record<string, string | number> = { limit };
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<GlobalTopClient[]>(
      '/global/reports/sales/top-clients',
      { params }
    );
    return response.data;
  },

  getMonthlySalesBreakdown: async (
    filters?: GlobalReportFilters
  ): Promise<MonthlySalesReport> => {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    if (filters?.schoolId) params.school_id = filters.schoolId;
    const response = await apiClient.get<MonthlySalesReport>(
      '/global/reports/sales/monthly',
      { params }
    );
    return response.data;
  },

  getCashFlow: async (filters?: DateFilters): Promise<CashFlowReport> => {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<CashFlowReport>(
      '/global/accounting/cash-flow',
      { params }
    );
    return response.data;
  },

  getExpensesByCategory: async (
    filters?: DateFilters
  ): Promise<ExpenseCategory[]> => {
    const params: Record<string, string> = {};
    if (filters?.startDate) params.start_date = filters.startDate;
    if (filters?.endDate) params.end_date = filters.endDate;
    const response = await apiClient.get<ExpenseCategory[]>(
      '/global/accounting/expenses/by-category',
      { params }
    );
    return response.data;
  },
};

export default reportsService;
