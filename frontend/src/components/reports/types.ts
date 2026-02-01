/**
 * Shared types for reports components
 */
import type { School } from '../../services/schoolService';
import type {
  DashboardSummary,
  TopProduct,
  LowStockProduct,
  TopClient,
  SalesSummary,
  DateFilters,
  GlobalSalesSummary,
  GlobalTopProduct,
  GlobalTopClient,
  MonthlySalesReport,
  SchoolProfitability,
  ProfitabilityBySchoolResponse
} from '../../services/reportsService';
import type { AlterationsSummary, AlterationListItem } from '../../types/api';
import type { InventoryLog } from '../../services/inventoryLogService';

// Tab type
export type ReportTab = 'sales' | 'financial' | 'movements' | 'alterations' | 'inventory' | 'analysis' | 'profitability';

// Preset date ranges
export type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom' | 'all';

// Transaction types
export interface TransactionItem {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  payment_method: string;
  description: string;
  category: string | null;
  reference_code: string | null;
  transaction_date: string;
  created_at: string;
  school_id: string | null;
  school_name: string | null;
}

export interface ExpenseCategory {
  category: string;
  category_label: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  count: number;
  percentage: number;
}

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

export interface BalanceEntry {
  id: string;
  account_id: string;
  account_name: string;
  account_code: string;
  amount: number;
  balance_after: number;
  description: string;
  reference: string | null;
  created_at: string;
}

export interface BalanceAccount {
  id: string;
  name: string;
  code: string | null;
  account_type: string;
  balance?: number;
  net_value?: number;
  is_active?: boolean;
}

// Helper to format date as YYYY-MM-DD
export const formatDateForAPI = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Helper to get preset date ranges
export const getPresetDates = (preset: DatePreset): DateFilters => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today':
      return {
        startDate: formatDateForAPI(today),
        endDate: formatDateForAPI(today)
      };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return {
        startDate: formatDateForAPI(weekAgo),
        endDate: formatDateForAPI(today)
      };
    }
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDateForAPI(monthStart),
        endDate: formatDateForAPI(today)
      };
    }
    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: formatDateForAPI(yearStart),
        endDate: formatDateForAPI(today)
      };
    }
    case 'all':
    default:
      return {}; // No filters = all time
  }
};

// Helper to validate UUID format
export const isValidUUID = (str: string): boolean => {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Helper to parse API errors
export const parseApiError = (err: any) => {
  // Log full error for debugging
  console.error('[parseApiError] Full error:', err);
  console.error('[parseApiError] Error type:', typeof err);
  console.error('[parseApiError] Error message:', err?.message);
  console.error('[parseApiError] Error name:', err?.name);

  // Error de red (backend caido, CORS, timeout)
  if (!err.response) {
    // Get message from Error object or string
    const errorMessage = err instanceof Error
      ? err.message
      : (typeof err === 'string' ? err : String(err));

    return {
      userMessage: errorMessage || 'No se pudo conectar con el servidor. Verifica tu conexion.',
      technicalMessage: errorMessage,
      status: null
    };
  }

  const { status, data } = err.response;

  // Errores comunes del backend
  const backendMessage =
    data?.detail ||
    data?.message ||
    data?.error ||
    (Array.isArray(data?.errors) ? data.errors.join(', ') : null);

  return {
    userMessage:
      backendMessage ||
      `Error del servidor (${status}). Intenta nuevamente.`,
    technicalMessage: JSON.stringify(data),
    status
  };
};

// Helper to format date for display
export const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Helper to generate month options for dropdown
export const getMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
    });
  }
  return options;
};

// Re-export types for convenience
export type {
  School,
  DashboardSummary,
  TopProduct,
  LowStockProduct,
  TopClient,
  SalesSummary,
  DateFilters,
  GlobalSalesSummary,
  GlobalTopProduct,
  GlobalTopClient,
  MonthlySalesReport,
  SchoolProfitability,
  ProfitabilityBySchoolResponse,
  AlterationsSummary,
  AlterationListItem,
  InventoryLog
};
