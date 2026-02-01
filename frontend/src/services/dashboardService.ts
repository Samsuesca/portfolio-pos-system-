/**
 * Dashboard Service - API calls for dashboard stats
 */
import apiClient from '../utils/api-client';
import type { SchoolSummary } from '../types/api';

export interface DashboardStats {
  total_products: number;
  total_clients: number;
  total_sales: number;
  total_orders: number;
}

export interface SchoolStats extends DashboardStats {
  school_id: string;
  school_name: string;
  school_code: string;
}

export interface AggregatedDashboardStats {
  totals: DashboardStats;
  by_school: SchoolStats[];
  school_count: number;
}

// ============= New Global Dashboard Types =============

export interface GlobalDashboardTotals {
  total_sales: number;         // Count of sales (no $ sign)
  sales_amount_month: number;  // Amount in currency
  total_orders: number;        // Count of orders
  pending_orders: number;      // Pending + in_production
  total_clients: number;
  total_products: number;
}

export interface SchoolSummaryItem {
  school_id: string;
  school_name: string;
  school_code: string;
  sales_count: number;
  sales_amount: number;
  pending_orders: number;
}

export interface GlobalDashboardStats {
  totals: GlobalDashboardTotals;
  schools_summary: SchoolSummaryItem[];
  school_count: number;
}

export const dashboardService = {
  /**
   * Get school summary with stats
   */
  async getSchoolSummary(schoolId: string): Promise<SchoolSummary> {
    const response = await apiClient.get<SchoolSummary>(`/schools/${schoolId}/summary`);
    return response.data;
  },

  /**
   * Get dashboard stats for a single school (simplified)
   */
  async getStats(schoolId: string): Promise<DashboardStats> {
    const summary = await this.getSchoolSummary(schoolId);
    return {
      total_products: summary.total_products,
      total_clients: summary.total_clients,
      total_sales: summary.total_sales,
      total_orders: summary.total_orders || 0,
    };
  },

  /**
   * Get aggregated stats for multiple schools
   */
  async getAggregatedStats(schools: { id: string; name: string; code: string }[]): Promise<AggregatedDashboardStats> {
    // Fetch stats for all schools in parallel
    const statsPromises = schools.map(async (school) => {
      try {
        const summary = await this.getSchoolSummary(school.id);
        return {
          school_id: school.id,
          school_name: school.name,
          school_code: school.code,
          total_products: summary.total_products || 0,
          total_clients: summary.total_clients || 0,
          total_sales: summary.total_sales || 0,
          total_orders: summary.total_orders || 0,
        };
      } catch {
        // If a school fails, return zeros
        return {
          school_id: school.id,
          school_name: school.name,
          school_code: school.code,
          total_products: 0,
          total_clients: 0,
          total_sales: 0,
          total_orders: 0,
        };
      }
    });

    const schoolStats = await Promise.all(statsPromises);

    // Calculate totals
    const totals = schoolStats.reduce(
      (acc, stats) => ({
        total_products: acc.total_products + stats.total_products,
        total_clients: acc.total_clients + stats.total_clients,
        total_sales: acc.total_sales + stats.total_sales,
        total_orders: acc.total_orders + stats.total_orders,
      }),
      { total_products: 0, total_clients: 0, total_sales: 0, total_orders: 0 }
    );

    return {
      totals,
      by_school: schoolStats,
      school_count: schools.length,
    };
  },

  /**
   * Get GLOBAL dashboard stats (aggregated across all user's schools)
   * Does NOT depend on school selector - fetches everything in one call
   */
  async getGlobalStats(): Promise<GlobalDashboardStats> {
    const response = await apiClient.get<GlobalDashboardStats>('/global/dashboard/stats');
    return response.data;
  },
};
