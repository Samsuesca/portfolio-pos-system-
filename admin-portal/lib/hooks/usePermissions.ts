'use client';

/**
 * Hook for granular permission checks
 *
 * This hook provides fine-grained permission checking for the current user
 * based on the granular permission system. It works alongside useUserRole
 * but provides more specific permission checks.
 *
 * Permission priority:
 * 1. Backend-provided permissions (from user.school_roles[].permissions)
 * 2. Fallback to local SYSTEM_ROLE_PERMISSIONS if backend doesn't provide them
 */
import { useMemo, useCallback } from 'react';
import { useAdminAuth } from '../adminAuth';
import { useSchoolStore } from '../stores/schoolStore';

export type UserRole = 'owner' | 'admin' | 'seller' | 'viewer';

// Default permissions for system roles (mirrors backend)
const SYSTEM_ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  viewer: new Set([
    'sales.view', 'products.view', 'clients.view', 'orders.view',
    'inventory.view', 'changes.view', 'alterations.view', 'reports.dashboard'
  ]),
  seller: new Set([
    'sales.view', 'products.view', 'clients.view', 'orders.view',
    'inventory.view', 'changes.view', 'alterations.view', 'reports.dashboard',
    'sales.create', 'sales.apply_discount', 'sales.add_payment',
    'clients.create', 'clients.edit',
    'orders.create', 'orders.edit', 'orders.add_payment',
    'changes.create', 'reports.sales',
    // Accounting micro-permissions for sellers
    'accounting.view_caja_menor', 'accounting.open_register',
    // Workforce micro-permissions for sellers
    'workforce.view_shifts', 'workforce.self_checklist'
  ]),
  admin: new Set([
    'sales.view', 'products.view', 'clients.view', 'orders.view',
    'inventory.view', 'changes.view', 'alterations.view', 'reports.dashboard',
    'sales.create', 'sales.apply_discount', 'sales.add_payment',
    'clients.create', 'clients.edit',
    'orders.create', 'orders.edit', 'orders.add_payment',
    'changes.create', 'reports.sales',
    'sales.edit', 'sales.cancel', 'sales.view_cost', 'sales.view_all_sellers',
    'changes.approve', 'changes.reject',
    'products.create', 'products.edit', 'products.delete', 'products.set_price', 'products.set_cost',
    'inventory.view_cost', 'inventory.adjust', 'inventory.report',
    'global_inventory.adjust',
    'clients.delete', 'clients.view_balance',
    'orders.cancel', 'orders.change_status', 'orders.view_all_sellers', 'orders.deliver',
    // Accounting micro-permissions for admins
    'accounting.view_cash', 'accounting.view_expenses', 'accounting.create_expense',
    'accounting.pay_expense', 'accounting.view_receivables', 'accounting.manage_receivables',
    'accounting.view_payables', 'accounting.manage_payables', 'accounting.view_transactions',
    'accounting.view_balance', 'accounting.view_bank',
    'accounting.open_register', 'accounting.close_register',
    'accounting.view_caja_menor', 'accounting.liquidate_caja_menor',
    'accounting.view_liquidation_history', 'accounting.adjust_balance',
    'accounting.view_daily_flow', 'accounting.view_global_balances',
    'accounting.edit_caja_menor_config',
    'accounting.transfer_between_accounts', 'accounting.view_transfers',
    // Alterations
    'alterations.create', 'alterations.edit', 'alterations.change_status', 'alterations.add_payment',
    'reports.inventory', 'reports.financial', 'reports.export',
    // Cash drawer
    'cash_drawer.open',
    // Settings
    'settings.edit_business_info',
    // Workforce micro-permissions for admins
    'workforce.view_shifts', 'workforce.manage_shifts',
    'workforce.view_attendance', 'workforce.manage_attendance',
    'workforce.view_absences', 'workforce.manage_absences',
    'workforce.view_checklists', 'workforce.manage_checklists',
    'workforce.view_performance', 'workforce.manage_performance',
    'workforce.view_deductions'
  ]),
  owner: new Set<string>(), // Owner gets ALL permissions - handled specially
};

// Default max discount percentages by role
const SYSTEM_ROLE_MAX_DISCOUNT: Record<UserRole, number> = {
  viewer: 0,
  seller: 10,
  admin: 25,
  owner: 100,
};

export interface UsePermissionsResult {
  // Check if user has a specific permission
  hasPermission: (permissionCode: string) => boolean;

  // Check if user has any of the specified permissions
  hasAnyPermission: (...permissionCodes: string[]) => boolean;

  // Check if user has all of the specified permissions
  hasAllPermissions: (...permissionCodes: string[]) => boolean;

  // Get the set of all permissions the user has
  permissions: Set<string>;

  // Get max discount percentage
  maxDiscountPercent: number;

  // Is user an owner or superuser (can manage users)
  canManageSchoolUsers: boolean;

  // Quick access helpers - General
  canViewCosts: boolean;
  canCancelSales: boolean;
  canApplyDiscount: boolean;
  canAdjustInventory: boolean;
  canManageAccounting: boolean;
  canApproveChanges: boolean;
  canManageProducts: boolean;
  canExportReports: boolean;
  canManageWorkforce: boolean;

  // Quick access helpers - Accounting (granular)
  canViewCash: boolean;
  canViewBank: boolean;
  canViewExpenses: boolean;
  canCreateExpense: boolean;
  canPayExpense: boolean;
  canViewReceivables: boolean;
  canManageReceivables: boolean;
  canViewPayables: boolean;
  canManagePayables: boolean;
  canViewTransactions: boolean;
  canViewDailyFlow: boolean;
  canViewGlobalBalances: boolean;
  canCloseRegister: boolean;
  canOpenRegister: boolean;
  canAdjustBalance: boolean;
  canLiquidateCajaMenor: boolean;
  canViewCajaMenor: boolean;
  canViewTransfers: boolean;
  canTransferBetweenAccounts: boolean;

  // Computed helpers
  canAccessAccounting: boolean;  // Has any accounting.* permission
  canAccessFinance: boolean;     // Can view financial data
  isSuperuser: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useAdminAuth();
  const { currentSchool } = useSchoolStore();

  return useMemo(() => {
    // Default result for no user/school
    const defaultResult: UsePermissionsResult = {
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      permissions: new Set(),
      maxDiscountPercent: 0,
      canManageSchoolUsers: false,
      canViewCosts: false,
      canCancelSales: false,
      canApplyDiscount: false,
      canAdjustInventory: false,
      canManageAccounting: false,
      canApproveChanges: false,
      canManageProducts: false,
      canExportReports: false,
      canManageWorkforce: false,
      // Accounting granular
      canViewCash: false,
      canViewBank: false,
      canViewExpenses: false,
      canCreateExpense: false,
      canPayExpense: false,
      canViewReceivables: false,
      canManageReceivables: false,
      canViewPayables: false,
      canManagePayables: false,
      canViewTransactions: false,
      canViewDailyFlow: false,
      canViewGlobalBalances: false,
      canCloseRegister: false,
      canOpenRegister: false,
      canAdjustBalance: false,
      canLiquidateCajaMenor: false,
      canViewCajaMenor: false,
      canViewTransfers: false,
      canTransferBetweenAccounts: false,
      canAccessAccounting: false,
      canAccessFinance: false,
      isSuperuser: false,
    };

    if (!user) {
      return defaultResult;
    }

    // Superusers get all permissions
    if (user.is_superuser) {
      return {
        hasPermission: () => true,
        hasAnyPermission: () => true,
        hasAllPermissions: () => true,
        permissions: new Set(['*']), // Symbolic "all"
        maxDiscountPercent: 100,
        canManageSchoolUsers: true,
        canViewCosts: true,
        canCancelSales: true,
        canApplyDiscount: true,
        canAdjustInventory: true,
        canManageAccounting: true,
        canApproveChanges: true,
        canManageProducts: true,
        canExportReports: true,
        canManageWorkforce: true,
        // Accounting granular - all true for superuser
        canViewCash: true,
        canViewBank: true,
        canViewExpenses: true,
        canCreateExpense: true,
        canPayExpense: true,
        canViewReceivables: true,
        canManageReceivables: true,
        canViewPayables: true,
        canManagePayables: true,
        canViewTransactions: true,
        canViewDailyFlow: true,
        canViewGlobalBalances: true,
        canCloseRegister: true,
        canOpenRegister: true,
        canAdjustBalance: true,
        canLiquidateCajaMenor: true,
        canViewCajaMenor: true,
        canViewTransfers: true,
        canTransferBetweenAccounts: true,
        canAccessAccounting: true,
        canAccessFinance: true,
        isSuperuser: true,
      };
    }

    // Helper to build full permissions result for owner role
    const buildOwnerResult = (): UsePermissionsResult => ({
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
      permissions: new Set(['*']), // Symbolic "all"
      maxDiscountPercent: 100,
      canManageSchoolUsers: true,
      canViewCosts: true,
      canCancelSales: true,
      canApplyDiscount: true,
      canAdjustInventory: true,
      canManageAccounting: true,
      canApproveChanges: true,
      canManageProducts: true,
      canExportReports: true,
      canManageWorkforce: true,
      canViewCash: true,
      canViewBank: true,
      canViewExpenses: true,
      canCreateExpense: true,
      canPayExpense: true,
      canViewReceivables: true,
      canManageReceivables: true,
      canViewPayables: true,
      canManagePayables: true,
      canViewTransactions: true,
      canViewDailyFlow: true,
      canViewGlobalBalances: true,
      canCloseRegister: true,
      canOpenRegister: true,
      canAdjustBalance: true,
      canLiquidateCajaMenor: true,
      canViewCajaMenor: true,
      canViewTransfers: true,
      canTransferBetweenAccounts: true,
      canAccessAccounting: true,
      canAccessFinance: true,
      isSuperuser: false,
    });

    // Determine permissions based on school selection
    let permissions: Set<string>;
    let maxDiscountPercent: number = 0;

    if (currentSchool) {
      // School selected - use that school's specific role
      const schoolRole = user.school_roles?.find((r) => r.school_id === currentSchool.id);

      if (!schoolRole) {
        return defaultResult;
      }

      // Owner gets all permissions
      if (schoolRole.role === 'owner') {
        return buildOwnerResult();
      }

      // Use backend-provided permissions if available
      if (schoolRole.permissions && Array.isArray(schoolRole.permissions) && schoolRole.permissions.length > 0) {
        permissions = new Set(schoolRole.permissions);
        maxDiscountPercent = schoolRole.max_discount_percent ?? SYSTEM_ROLE_MAX_DISCOUNT[schoolRole.role as UserRole] ?? 0;
      }
      // Fallback to local system role defaults
      else if (schoolRole.role) {
        permissions = SYSTEM_ROLE_PERMISSIONS[schoolRole.role as UserRole] || new Set();
        maxDiscountPercent = SYSTEM_ROLE_MAX_DISCOUNT[schoolRole.role as UserRole] || 0;
      } else {
        return defaultResult;
      }
    } else {
      // No school selected - aggregate permissions from ALL roles
      // This allows the dashboard/sidebar to show all available options
      const schoolRoles = user.school_roles || [];

      if (schoolRoles.length === 0) {
        return defaultResult;
      }

      permissions = new Set<string>();

      for (const role of schoolRoles) {
        // Owner in any school = all permissions
        if (role.role === 'owner') {
          return buildOwnerResult();
        }

        // Add backend-provided permissions
        if (role.permissions && Array.isArray(role.permissions) && role.permissions.length > 0) {
          role.permissions.forEach((p: string) => permissions.add(p));
          const roleDiscount = role.max_discount_percent ?? SYSTEM_ROLE_MAX_DISCOUNT[role.role as UserRole] ?? 0;
          maxDiscountPercent = Math.max(maxDiscountPercent, roleDiscount);
        }
        // Fallback to system role defaults
        else if (role.role) {
          const systemPerms = SYSTEM_ROLE_PERMISSIONS[role.role as UserRole];
          if (systemPerms) {
            systemPerms.forEach((p: string) => permissions.add(p));
          }
          const roleDiscount = SYSTEM_ROLE_MAX_DISCOUNT[role.role as UserRole] || 0;
          maxDiscountPercent = Math.max(maxDiscountPercent, roleDiscount);
        }
      }

      if (permissions.size === 0) {
        return defaultResult;
      }
    }

    const hasPermission = (code: string) => permissions.has(code);
    const hasAnyPermission = (...codes: string[]) => codes.some(c => permissions.has(c));
    const hasAllPermissions = (...codes: string[]) => codes.every(c => permissions.has(c));

    return {
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      permissions,
      maxDiscountPercent,
      canManageSchoolUsers: false, // Only owner/superuser can manage users

      // General helpers
      canViewCosts: hasAnyPermission('sales.view_cost', 'inventory.view_cost'),
      canCancelSales: hasPermission('sales.cancel'),
      canApplyDiscount: hasPermission('sales.apply_discount'),
      canAdjustInventory: hasPermission('inventory.adjust'),
      canManageAccounting: hasAnyPermission(
        'accounting.create_expense',
        'accounting.manage_receivables',
        'accounting.manage_payables'
      ),
      canApproveChanges: hasAnyPermission('changes.approve', 'changes.reject'),
      canManageProducts: hasAnyPermission('products.create', 'products.edit', 'products.delete'),
      canExportReports: hasPermission('reports.export'),
      canManageWorkforce: hasAnyPermission('workforce.manage_shifts', 'workforce.manage_attendance'),

      // Accounting granular helpers
      canViewCash: hasPermission('accounting.view_cash'),
      canViewBank: hasPermission('accounting.view_bank'),
      canViewExpenses: hasPermission('accounting.view_expenses'),
      canCreateExpense: hasPermission('accounting.create_expense'),
      canPayExpense: hasPermission('accounting.pay_expense'),
      canViewReceivables: hasPermission('accounting.view_receivables'),
      canManageReceivables: hasPermission('accounting.manage_receivables'),
      canViewPayables: hasPermission('accounting.view_payables'),
      canManagePayables: hasPermission('accounting.manage_payables'),
      canViewTransactions: hasPermission('accounting.view_transactions'),
      canViewDailyFlow: hasPermission('accounting.view_daily_flow'),
      canViewGlobalBalances: hasPermission('accounting.view_global_balances'),
      canCloseRegister: hasPermission('accounting.close_register'),
      canOpenRegister: hasPermission('accounting.open_register'),
      canAdjustBalance: hasPermission('accounting.adjust_balance'),
      canLiquidateCajaMenor: hasPermission('accounting.liquidate_caja_menor'),
      canViewCajaMenor: hasPermission('accounting.view_caja_menor'),
      canViewTransfers: hasPermission('accounting.view_transfers'),
      canTransferBetweenAccounts: hasPermission('accounting.transfer_between_accounts'),

      // Computed helpers
      canAccessAccounting: hasAnyPermission(
        'accounting.view_cash',
        'accounting.view_bank',
        'accounting.view_expenses',
        'accounting.view_caja_menor'
      ),
      canAccessFinance: hasAnyPermission(
        'accounting.view_cash',
        'accounting.view_bank',
        'accounting.view_expenses',
        'accounting.view_receivables',
        'accounting.view_payables'
      ),
      isSuperuser: false,
    };
  }, [user, currentSchool]);
}

/**
 * Hook version for simple permission checks
 */
export function usePermissionCheck(permissionCode: string): boolean {
  const { hasPermission } = usePermissions();
  return hasPermission(permissionCode);
}

/**
 * Hook to check if user can perform action with discount
 */
export function useDiscountPermission(): {
  canApplyDiscount: boolean;
  maxPercent: number;
  validateDiscount: (percent: number) => boolean;
} {
  const { canApplyDiscount, maxDiscountPercent } = usePermissions();

  const validateDiscount = useCallback(
    (percent: number) => {
      if (!canApplyDiscount) return false;
      return percent <= maxDiscountPercent;
    },
    [canApplyDiscount, maxDiscountPercent]
  );

  return {
    canApplyDiscount,
    maxPercent: maxDiscountPercent,
    validateDiscount,
  };
}

export default usePermissions;
