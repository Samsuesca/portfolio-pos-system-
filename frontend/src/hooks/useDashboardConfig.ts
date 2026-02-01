/**
 * Hook for dashboard configuration based on granular user permissions (micropermisos)
 *
 * This hook provides fine-grained control over dashboard elements based on
 * the user's specific permissions, not just their role.
 */
import { useMemo } from 'react';
import { usePermissions } from './usePermissions';
import type { LucideIcon } from 'lucide-react';
import {
  ShoppingCart,
  FileText,
  Package,
  Users,
  Wallet,
  Scissors,
  Receipt,
  BarChart3,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

export type WidgetType =
  | 'recent_sales'
  | 'upcoming_orders'
  | 'alterations'
  | 'daily_finance'
  | 'low_stock'
  | 'pqrs';

export interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  link: string;
  color: string;
  bgColor: string;
  borderColor: string;
  highlight?: boolean;
  /** Permission code required to show this action */
  permission: string;
}

/** Granular stat card visibility based on micropermisos */
export interface StatsVisibility {
  sales: boolean;           // sales.view
  orders: boolean;          // orders.view
  clients: boolean;         // clients.view
  products: boolean;        // products.view
  cashBalance: boolean;     // accounting.view_cash
  alterations: boolean;     // alterations.view
  receivables: boolean;     // accounting.view_receivables
  expenses: boolean;        // accounting.view_expenses
}

/** Granular widget visibility based on micropermisos */
export interface WidgetsVisibility {
  recentSales: boolean;     // sales.view
  upcomingOrders: boolean;  // orders.view
  alterations: boolean;     // alterations.view
  dailyFinance: boolean;    // accounting.view_cash || accounting.view_expenses
  lowStock: boolean;        // inventory.view
  pqrs: boolean;            // Always visible (public contact)
  schoolSummary: boolean;   // sales.view && orders.view (multi-school)
}

/** Granular alert visibility based on micropermisos */
export interface AlertsVisibility {
  overdueOrders: boolean;   // orders.view
  todayOrders: boolean;     // orders.view
  tomorrowOrders: boolean;  // orders.view
  criticalStock: boolean;   // inventory.view
  alterationsReady: boolean; // alterations.view
  unpaidReceivables: boolean; // accounting.view_receivables
}

/** All permission checks exposed for components */
export interface PermissionChecks {
  // Sales
  canViewSales: boolean;
  canCreateSales: boolean;
  canEditSales: boolean;
  canCancelSales: boolean;
  canApplyDiscount: boolean;
  canViewAllSellers: boolean;
  canViewCosts: boolean;

  // Orders
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canCancelOrders: boolean;
  canChangeOrderStatus: boolean;
  canDeliverOrders: boolean;

  // Clients
  canViewClients: boolean;
  canCreateClients: boolean;
  canEditClients: boolean;
  canDeleteClients: boolean;
  canViewClientBalance: boolean;

  // Products
  canViewProducts: boolean;
  canCreateProducts: boolean;
  canEditProducts: boolean;
  canDeleteProducts: boolean;
  canSetPrice: boolean;
  canSetCost: boolean;

  // Inventory
  canViewInventory: boolean;
  canAdjustInventory: boolean;
  canViewInventoryCost: boolean;
  canGenerateInventoryReport: boolean;

  // Accounting
  canViewCash: boolean;
  canViewExpenses: boolean;
  canCreateExpense: boolean;
  canPayExpense: boolean;
  canViewReceivables: boolean;
  canManageReceivables: boolean;
  canViewPayables: boolean;
  canManagePayables: boolean;
  canViewTransactions: boolean;
  canViewBalance: boolean;
  canViewDailyFlow: boolean;
  canViewGlobalBalances: boolean;
  canViewCajaMenor: boolean;
  canAdjustBalance: boolean;
  canLiquidateCajaMenor: boolean;
  canCloseRegister: boolean;

  // Alterations
  canViewAlterations: boolean;
  canCreateAlterations: boolean;
  canEditAlterations: boolean;
  canChangeAlterationStatus: boolean;
  canAddAlterationPayment: boolean;

  // Changes (returns/exchanges)
  canViewChanges: boolean;
  canCreateChanges: boolean;
  canApproveChanges: boolean;
  canRejectChanges: boolean;

  // Reports
  canViewDashboard: boolean;
  canViewSalesReport: boolean;
  canViewInventoryReport: boolean;
  canViewFinancialReport: boolean;
  canExportReports: boolean;
}

export interface DashboardConfig {
  /** Granular stat card visibility */
  stats: StatsVisibility;

  /** Granular widget visibility */
  widgets: WidgetsVisibility;

  /** Granular alert visibility */
  alerts: AlertsVisibility;

  /** All permission checks for fine-grained control */
  permissions: PermissionChecks;

  /** Quick actions filtered by permissions */
  quickActions: QuickAction[];

  /** Max discount percentage user can apply */
  maxDiscountPercent: number;

  // Legacy compatibility (deprecated - use stats/widgets/permissions instead)
  /** @deprecated Use stats.cashBalance || stats.expenses */
  showFinancialStats: boolean;
  /** @deprecated Use stats.alterations */
  showAlterationsStats: boolean;
  /** @deprecated Use widgets object */
  visibleWidgets: WidgetType[];
  /** @deprecated Use widgets.dailyFinance */
  showFinancialWidget: boolean;
  /** @deprecated Use widgets.alterations */
  showAlterationsWidget: boolean;
  /** @deprecated Use alerts object */
  showFinancialAlerts: boolean;
  /** @deprecated Use alerts.alterationsReady */
  showAlterationAlerts: boolean;
  /** @deprecated Use permissions.canViewCash || permissions.canViewExpenses */
  canViewFinance: boolean;
  /** @deprecated Use permissions.canViewAlterations */
  canViewAlterations: boolean;
  /** @deprecated Use permissions.canCreateSales */
  canCreateSales: boolean;
  /** @deprecated Use permissions.canCreateOrders */
  canCreateOrders: boolean;
}

/**
 * All available quick actions with their permission requirements
 */
const ALL_QUICK_ACTIONS: Omit<QuickAction, 'highlight'>[] = [
  {
    id: 'new_sale',
    label: 'Nueva Venta',
    icon: ShoppingCart,
    link: '/sales',
    color: 'text-green-700',
    bgColor: 'bg-green-50 hover:bg-green-100',
    borderColor: 'border-green-200',
    permission: 'sales.create',
  },
  {
    id: 'new_order',
    label: 'Nuevo Encargo',
    icon: FileText,
    link: '/orders',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 hover:bg-blue-100',
    borderColor: 'border-blue-200',
    permission: 'orders.create',
  },
  {
    id: 'view_products',
    label: 'Ver Productos',
    icon: Package,
    link: '/products',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 hover:bg-purple-100',
    borderColor: 'border-purple-200',
    permission: 'products.view',
  },
  {
    id: 'view_clients',
    label: 'Ver Clientes',
    icon: Users,
    link: '/clients',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50 hover:bg-orange-100',
    borderColor: 'border-orange-200',
    permission: 'clients.view',
  },
  {
    id: 'cash_register',
    label: 'Cierre de Caja',
    icon: Wallet,
    link: '/accounting',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100',
    borderColor: 'border-emerald-200',
    permission: 'accounting.view_cash',
  },
  {
    id: 'alterations',
    label: 'Ver Arreglos',
    icon: Scissors,
    link: '/alterations',
    color: 'text-pink-700',
    bgColor: 'bg-pink-50 hover:bg-pink-100',
    borderColor: 'border-pink-200',
    permission: 'alterations.view',
  },
  {
    id: 'new_expense',
    label: 'Registrar Gasto',
    icon: Receipt,
    link: '/accounting?tab=expenses',
    color: 'text-red-700',
    bgColor: 'bg-red-50 hover:bg-red-100',
    borderColor: 'border-red-200',
    permission: 'accounting.create_expense',
  },
  {
    id: 'reports',
    label: 'Ver Reportes',
    icon: BarChart3,
    link: '/reports',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100',
    borderColor: 'border-indigo-200',
    permission: 'reports.financial',
  },
  {
    id: 'receivables',
    label: 'Cuentas x Cobrar',
    icon: CreditCard,
    link: '/accounting?tab=receivables',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 hover:bg-amber-100',
    borderColor: 'border-amber-200',
    permission: 'accounting.view_receivables',
  },
  {
    id: 'inventory_adjust',
    label: 'Ajustar Inventario',
    icon: RefreshCw,
    link: '/products?action=inventory',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50 hover:bg-cyan-100',
    borderColor: 'border-cyan-200',
    permission: 'inventory.adjust',
  },
];

/**
 * Build quick actions based on user permissions and context
 * Priority order: actions that make sense for the current context
 */
function buildQuickActions(
  hasPermission: (code: string) => boolean,
  context?: { hasUrgentOrders?: boolean; isEndOfDay?: boolean }
): QuickAction[] {
  // Filter actions by permission
  const permitted = ALL_QUICK_ACTIONS.filter((action) =>
    hasPermission(action.permission)
  );

  // Apply contextual highlights
  const withHighlights: QuickAction[] = permitted.map((action) => ({
    ...action,
    highlight:
      (action.id === 'new_order' && context?.hasUrgentOrders) ||
      (action.id === 'cash_register' && context?.isEndOfDay),
  }));

  // Sort: highlighted actions first, then by priority (creation actions, then view actions)
  const priorityOrder = [
    'new_sale',
    'new_order',
    'cash_register',
    'alterations',
    'new_expense',
    'view_products',
    'view_clients',
    'receivables',
    'reports',
    'inventory_adjust',
  ];

  withHighlights.sort((a, b) => {
    // Highlighted items first
    if (a.highlight && !b.highlight) return -1;
    if (!a.highlight && b.highlight) return 1;
    // Then by priority order
    const aIndex = priorityOrder.indexOf(a.id);
    const bIndex = priorityOrder.indexOf(b.id);
    return aIndex - bIndex;
  });

  return withHighlights.slice(0, 6); // Max 6 actions
}

export function useDashboardConfig(context?: {
  hasUrgentOrders?: boolean;
  isEndOfDay?: boolean;
}): DashboardConfig {
  const { hasPermission, hasAnyPermission, maxDiscountPercent } = usePermissions();

  return useMemo(() => {
    // ============================================
    // Build granular permission checks
    // ============================================
    const permissions: PermissionChecks = {
      // Sales
      canViewSales: hasPermission('sales.view'),
      canCreateSales: hasPermission('sales.create'),
      canEditSales: hasPermission('sales.edit'),
      canCancelSales: hasPermission('sales.cancel'),
      canApplyDiscount: hasPermission('sales.apply_discount'),
      canViewAllSellers: hasPermission('sales.view_all_sellers'),
      canViewCosts: hasAnyPermission('sales.view_cost', 'inventory.view_cost'),

      // Orders
      canViewOrders: hasPermission('orders.view'),
      canCreateOrders: hasPermission('orders.create'),
      canEditOrders: hasPermission('orders.edit'),
      canCancelOrders: hasPermission('orders.cancel'),
      canChangeOrderStatus: hasPermission('orders.change_status'),
      canDeliverOrders: hasPermission('orders.deliver'),

      // Clients
      canViewClients: hasPermission('clients.view'),
      canCreateClients: hasPermission('clients.create'),
      canEditClients: hasPermission('clients.edit'),
      canDeleteClients: hasPermission('clients.delete'),
      canViewClientBalance: hasPermission('clients.view_balance'),

      // Products
      canViewProducts: hasPermission('products.view'),
      canCreateProducts: hasPermission('products.create'),
      canEditProducts: hasPermission('products.edit'),
      canDeleteProducts: hasPermission('products.delete'),
      canSetPrice: hasPermission('products.set_price'),
      canSetCost: hasPermission('products.set_cost'),

      // Inventory
      canViewInventory: hasPermission('inventory.view'),
      canAdjustInventory: hasPermission('inventory.adjust'),
      canViewInventoryCost: hasPermission('inventory.view_cost'),
      canGenerateInventoryReport: hasPermission('inventory.report'),

      // Accounting
      canViewCash: hasPermission('accounting.view_cash'),
      canViewExpenses: hasPermission('accounting.view_expenses'),
      canCreateExpense: hasPermission('accounting.create_expense'),
      canPayExpense: hasPermission('accounting.pay_expense'),
      canViewReceivables: hasPermission('accounting.view_receivables'),
      canManageReceivables: hasPermission('accounting.manage_receivables'),
      canViewPayables: hasPermission('accounting.view_payables'),
      canManagePayables: hasPermission('accounting.manage_payables'),
      canViewTransactions: hasPermission('accounting.view_transactions'),
      canViewBalance: hasPermission('accounting.view_balance'),
      canViewDailyFlow: hasPermission('accounting.view_daily_flow'),
      canViewGlobalBalances: hasPermission('accounting.view_global_balances'),
      canViewCajaMenor: hasPermission('accounting.view_caja_menor'),
      canAdjustBalance: hasPermission('accounting.adjust_balance'),
      canLiquidateCajaMenor: hasPermission('accounting.liquidate_caja_menor'),
      canCloseRegister: hasPermission('accounting.close_register'),

      // Alterations
      canViewAlterations: hasPermission('alterations.view'),
      canCreateAlterations: hasPermission('alterations.create'),
      canEditAlterations: hasPermission('alterations.edit'),
      canChangeAlterationStatus: hasPermission('alterations.change_status'),
      canAddAlterationPayment: hasPermission('alterations.add_payment'),

      // Changes
      canViewChanges: hasPermission('changes.view'),
      canCreateChanges: hasPermission('changes.create'),
      canApproveChanges: hasPermission('changes.approve'),
      canRejectChanges: hasPermission('changes.reject'),

      // Reports
      canViewDashboard: hasPermission('reports.dashboard'),
      canViewSalesReport: hasPermission('reports.sales'),
      canViewInventoryReport: hasPermission('reports.inventory'),
      canViewFinancialReport: hasPermission('reports.financial'),
      canExportReports: hasPermission('reports.export'),
    };

    // ============================================
    // Build granular stats visibility
    // ============================================
    const stats: StatsVisibility = {
      sales: permissions.canViewSales,
      orders: permissions.canViewOrders,
      clients: permissions.canViewClients,
      products: permissions.canViewProducts,
      cashBalance: permissions.canViewCash,
      alterations: permissions.canViewAlterations,
      receivables: permissions.canViewReceivables,
      expenses: permissions.canViewExpenses,
    };

    // ============================================
    // Build granular widgets visibility
    // ============================================
    const widgetsVisibility: WidgetsVisibility = {
      recentSales: permissions.canViewSales,
      upcomingOrders: permissions.canViewOrders,
      alterations: permissions.canViewAlterations,
      dailyFinance: permissions.canViewCash || permissions.canViewExpenses || permissions.canViewDailyFlow,
      lowStock: permissions.canViewInventory,
      pqrs: true, // Always visible - public contact
      schoolSummary: permissions.canViewSales && permissions.canViewOrders,
    };

    // ============================================
    // Build granular alerts visibility
    // ============================================
    const alerts: AlertsVisibility = {
      overdueOrders: permissions.canViewOrders,
      todayOrders: permissions.canViewOrders,
      tomorrowOrders: permissions.canViewOrders,
      criticalStock: permissions.canViewInventory,
      alterationsReady: permissions.canViewAlterations,
      unpaidReceivables: permissions.canViewReceivables,
    };

    // ============================================
    // Build legacy visible widgets list
    // ============================================
    const visibleWidgets: WidgetType[] = [];
    if (widgetsVisibility.recentSales) visibleWidgets.push('recent_sales');
    if (widgetsVisibility.upcomingOrders) visibleWidgets.push('upcoming_orders');
    if (widgetsVisibility.lowStock) visibleWidgets.push('low_stock');
    if (widgetsVisibility.alterations) visibleWidgets.push('alterations');
    if (widgetsVisibility.dailyFinance) visibleWidgets.push('daily_finance');
    if (widgetsVisibility.pqrs) visibleWidgets.push('pqrs');

    // ============================================
    // Build quick actions
    // ============================================
    const quickActions = buildQuickActions(hasPermission, context);

    // ============================================
    // Legacy compatibility values
    // ============================================
    const canViewFinance = permissions.canViewCash || permissions.canViewExpenses;
    const canViewAlterations = permissions.canViewAlterations;

    return {
      // New granular structure
      stats,
      widgets: widgetsVisibility,
      alerts,
      permissions,
      quickActions,
      maxDiscountPercent,

      // Legacy compatibility (deprecated)
      showFinancialStats: canViewFinance,
      showAlterationsStats: canViewAlterations,
      visibleWidgets,
      showFinancialWidget: widgetsVisibility.dailyFinance,
      showAlterationsWidget: widgetsVisibility.alterations,
      showFinancialAlerts: canViewFinance,
      showAlterationAlerts: alerts.alterationsReady,
      canViewFinance,
      canViewAlterations,
      canCreateSales: permissions.canCreateSales,
      canCreateOrders: permissions.canCreateOrders,
    };
  }, [hasPermission, hasAnyPermission, maxDiscountPercent, context]);
}

export default useDashboardConfig;
