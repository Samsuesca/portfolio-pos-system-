/**
 * CFO Dashboard Service - Executive financial health metrics
 */
import apiClient from '../utils/api-client';

// Types
export interface LiquidityMetrics {
  total: number;
  currency: string;
}

export interface DebtMetrics {
  total: number;
  overdue: number;
  due_30_days: number;
  debt_service_coverage_ratio: number;
}

export interface PayrollMetrics {
  monthly_estimate: number;
  employees: number;
  coverage_ratio: number;
  can_cover: boolean;
  integrated_with_fixed_expenses: boolean;
}

export interface OperationsMetrics {
  monthly_fixed_expenses: number;
  pending_expenses: number;
  monthly_burn_rate: number;
  cash_runway_days: number;
}

export interface DataQualityMetrics {
  score: number;
  products_with_cost: number;
  products_without_cost: number;
}

export interface AlertItem {
  type: 'critical' | 'warning';
  category: 'debt' | 'liquidity' | 'payroll' | 'data_quality';
  message: string;
  amount: number;
}

export interface AlertsMetrics {
  critical_count: number;
  warning_count: number;
  items: AlertItem[];
}

export interface HealthStatus {
  status: 'healthy' | 'caution' | 'warning' | 'critical';
  label: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
  score: number;
  breakdown: {
    debt_service: number;
    payroll: number;
    runway: number;
    data_quality: number;
  };
}

export interface CFODashboardMetrics {
  as_of: string;
  liquidity: LiquidityMetrics;
  debt: DebtMetrics;
  payroll: PayrollMetrics;
  operations: OperationsMetrics;
  data_quality: DataQualityMetrics;
  alerts: AlertsMetrics;
  health_status: HealthStatus;
}

/**
 * Get CFO health metrics
 */
export const getHealthMetrics = async (): Promise<CFODashboardMetrics> => {
  const response = await apiClient.get<CFODashboardMetrics>('/cfo-dashboard/health-metrics');
  return response.data;
};

/**
 * Get health status color class for Tailwind
 */
export const getHealthStatusColorClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500'
  };
  return colorMap[color] || 'bg-gray-500';
};

/**
 * Get health status text color class for Tailwind
 */
export const getHealthStatusTextClass = (color: string): string => {
  const colorMap: Record<string, string> = {
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600'
  };
  return colorMap[color] || 'text-gray-600';
};

/**
 * Get alert type color class
 */
export const getAlertColorClass = (type: 'critical' | 'warning'): string => {
  return type === 'critical'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-amber-50 border-amber-200 text-amber-800';
};

/**
 * Get alert icon color class
 */
export const getAlertIconClass = (type: 'critical' | 'warning'): string => {
  return type === 'critical' ? 'text-red-500' : 'text-amber-500';
};

/**
 * Format currency for display
 */
export const formatCFOCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString('es-CO')}`;
};

/**
 * Get DSCR status
 */
export const getDSCRStatus = (ratio: number): { status: string; color: string } => {
  if (ratio >= 2) return { status: 'Excelente', color: 'green' };
  if (ratio >= 1.25) return { status: 'Saludable', color: 'green' };
  if (ratio >= 1) return { status: 'Adecuado', color: 'yellow' };
  return { status: 'Critico', color: 'red' };
};

/**
 * Get runway status
 */
export const getRunwayStatus = (days: number): { status: string; color: string } => {
  if (days >= 90) return { status: 'Excelente', color: 'green' };
  if (days >= 60) return { status: 'Saludable', color: 'green' };
  if (days >= 30) return { status: 'Aceptable', color: 'yellow' };
  if (days >= 15) return { status: 'Bajo', color: 'orange' };
  return { status: 'Critico', color: 'red' };
};

export default {
  getHealthMetrics,
  getHealthStatusColorClass,
  getHealthStatusTextClass,
  getAlertColorClass,
  getAlertIconClass,
  formatCFOCurrency,
  getDSCRStatus,
  getRunwayStatus
};
