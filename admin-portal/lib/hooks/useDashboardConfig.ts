'use client';

/**
 * Hook for dynamic dashboard configuration based on user permissions
 *
 * This hook determines what elements to show in the dashboard based on
 * the user's permissions and role. It prevents 403 errors by only loading
 * data the user has access to.
 */
import { useMemo } from 'react';
import { useAdminAuth } from '../adminAuth';
import { usePermissions } from './usePermissions';

export interface DashboardStatsConfig {
  schools: boolean;      // Requires: superuser
  users: boolean;        // Requires: superuser
  sales: boolean;        // Requires: sales.view
  orders: boolean;       // Requires: orders.view
  cashBalance: boolean;  // Requires: accounting.view_cash
  expenses: boolean;     // Requires: accounting.view_expenses
  clients: boolean;      // Requires: clients.view
  products: boolean;     // Requires: products.view
  alterations: boolean;  // Requires: alterations.view
  receivables: boolean;  // Requires: accounting.view_receivables
}

export interface DashboardQuickAccessConfig {
  schools: boolean;
  users: boolean;
  paymentAccounts: boolean;
  deliveryZones: boolean;
  products: boolean;
  accounting: boolean;
  sales: boolean;
  orders: boolean;
  clients: boolean;
  alterations: boolean;
  workforce: boolean;
}

export interface DashboardWidgetsConfig {
  recentSales: boolean;
  upcomingOrders: boolean;
  alterations: boolean;
  dailyFinance: boolean;
  lowStock: boolean;
  systemStatus: boolean;
}

export interface DashboardConfig {
  // What stats cards to show
  stats: DashboardStatsConfig;

  // What quick access items to show
  quickAccess: DashboardQuickAccessConfig;

  // What widgets to show
  widgets: DashboardWidgetsConfig;

  // Is the user a superuser (show admin-only sections)
  isSuperuser: boolean;

  // Does user have any school role (not just superuser)
  hasSchoolAccess: boolean;

  // Show welcome message for new users with limited access
  showLimitedAccessMessage: boolean;
}

export function useDashboardConfig(): DashboardConfig {
  const { user } = useAdminAuth();
  const permissions = usePermissions();

  return useMemo(() => {
    const isSuperuser = user?.is_superuser ?? false;
    const hasSchoolRoles = (user?.school_roles?.length ?? 0) > 0;
    const hasSchoolAccess = hasSchoolRoles;

    // For superusers, show admin-focused dashboard
    if (isSuperuser) {
      return {
        stats: {
          schools: true,
          users: true,
          sales: true,
          orders: true,
          cashBalance: true,
          expenses: true,
          clients: true,
          products: true,
          alterations: true,
          receivables: true,
        },
        quickAccess: {
          schools: true,
          users: true,
          paymentAccounts: true,
          deliveryZones: true,
          products: true,
          accounting: true,
          sales: true,
          orders: true,
          clients: true,
          alterations: true,
          workforce: true,
        },
        widgets: {
          recentSales: true,
          upcomingOrders: true,
          alterations: true,
          dailyFinance: true,
          lowStock: true,
          systemStatus: true,
        },
        isSuperuser: true,
        hasSchoolAccess: true,
        showLimitedAccessMessage: false,
      };
    }

    // For regular users, show based on permissions
    const stats: DashboardStatsConfig = {
      schools: false, // Never for non-superusers
      users: false,   // Never for non-superusers
      sales: permissions.hasPermission('sales.view'),
      orders: permissions.hasPermission('orders.view'),
      cashBalance: permissions.canViewCash,
      expenses: permissions.canViewExpenses,
      clients: permissions.hasPermission('clients.view'),
      products: permissions.hasPermission('products.view'),
      alterations: permissions.hasPermission('alterations.view'),
      receivables: permissions.canViewReceivables,
    };

    const quickAccess: DashboardQuickAccessConfig = {
      schools: false, // Never for non-superusers
      users: false,   // Never for non-superusers
      paymentAccounts: permissions.canAccessAccounting,
      deliveryZones: permissions.hasPermission('orders.view'),
      products: permissions.hasPermission('products.view'),
      accounting: permissions.canAccessAccounting,
      sales: permissions.hasPermission('sales.view'),
      orders: permissions.hasPermission('orders.view'),
      clients: permissions.hasPermission('clients.view'),
      alterations: permissions.hasPermission('alterations.view'),
      workforce: permissions.hasAnyPermission('workforce.view_shifts', 'workforce.view_attendance'),
    };

    const widgets: DashboardWidgetsConfig = {
      recentSales: permissions.hasPermission('sales.view'),
      upcomingOrders: permissions.hasPermission('orders.view'),
      alterations: permissions.hasPermission('alterations.view'),
      dailyFinance: permissions.canAccessAccounting || permissions.canViewDailyFlow,
      lowStock: permissions.hasPermission('inventory.view'),
      systemStatus: false, // Only for superusers
    };

    // Check if user has very limited access (only viewer permissions)
    const hasAnyMeaningfulAccess = Object.values(stats).some(Boolean) ||
      Object.values(quickAccess).some(Boolean);

    return {
      stats,
      quickAccess,
      widgets,
      isSuperuser: false,
      hasSchoolAccess,
      showLimitedAccessMessage: !hasAnyMeaningfulAccess && hasSchoolAccess,
    };
  }, [user, permissions]);
}

export default useDashboardConfig;
