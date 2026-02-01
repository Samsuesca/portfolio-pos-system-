/**
 * Hook for granular permission checks
 *
 * This hook provides fine-grained permission checking for the current user
 * based on the new granular permission system. It works alongside useUserRole
 * but provides more specific permission checks.
 */
import { useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import type { UserRole, PermissionConstraints } from '../types/api';

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
    // Cash micro-permissions for sellers
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
    'clients.delete', 'clients.view_balance',
    'orders.cancel', 'orders.change_status', 'orders.view_all_sellers', 'orders.deliver',
    'accounting.view_cash', 'accounting.view_expenses', 'accounting.create_expense',
    'accounting.pay_expense', 'accounting.view_receivables', 'accounting.manage_receivables',
    'accounting.view_payables', 'accounting.manage_payables', 'accounting.view_transactions',
    'accounting.view_balance',
    'alterations.create', 'alterations.edit', 'alterations.change_status', 'alterations.add_payment',
    'reports.inventory', 'reports.financial', 'reports.export',
    'cash_drawer.open',
    'settings.edit_business_info',
    // Cash micro-permissions for admins
    'accounting.open_register', 'accounting.close_register',
    'accounting.view_caja_menor', 'accounting.liquidate_caja_menor',
    'accounting.view_liquidation_history', 'accounting.adjust_balance',
    'accounting.view_daily_flow', 'accounting.view_global_balances',
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

  // Get constraints for a specific permission
  getConstraints: (permissionCode: string) => PermissionConstraints | undefined;

  // Is user an owner or superuser (can manage users)
  canManageSchoolUsers: boolean;

  // Quick access helpers
  canViewCosts: boolean;
  canCancelSales: boolean;
  canApplyDiscount: boolean;
  canAdjustInventory: boolean;
  canManageAccounting: boolean;
  canApproveChanges: boolean;
  canManageProducts: boolean;
  canExportReports: boolean;

  // Cash micro-permission helpers
  canLiquidateCajaMenor: boolean;
  canCloseRegister: boolean;
  canAdjustBalance: boolean;
  canViewDailyFlow: boolean;
  canViewCajaMenor: boolean;

  // Workforce micro-permission helpers
  canManageWorkforce: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useAuthStore();
  const { currentSchool } = useSchoolStore();

  return useMemo(() => {
    const noConstraints = (_code: string) => undefined;

    // Default result for no user/school
    const defaultResult: UsePermissionsResult = {
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      permissions: new Set(),
      maxDiscountPercent: 0,
      getConstraints: noConstraints,
      canManageSchoolUsers: false,
      canViewCosts: false,
      canCancelSales: false,
      canApplyDiscount: false,
      canAdjustInventory: false,
      canManageAccounting: false,
      canApproveChanges: false,
      canManageProducts: false,
      canExportReports: false,
      canLiquidateCajaMenor: false,
      canCloseRegister: false,
      canAdjustBalance: false,
      canViewDailyFlow: false,
      canViewCajaMenor: false,
      canManageWorkforce: false,
    };

    if (!user || !currentSchool) {
      return defaultResult;
    }

    // Find user's role for current school
    const schoolRole = user.school_roles?.find(
      (r) => r.school_id === currentSchool.id
    );

    // Constraints from backend
    const constraintsMap = schoolRole?.constraints || {};
    const getConstraints = (code: string) => constraintsMap[code];

    // Superusers get all permissions
    if (user.is_superuser) {
      return {
        hasPermission: () => true,
        hasAnyPermission: () => true,
        hasAllPermissions: () => true,
        permissions: new Set(['*']), // Symbolic "all"
        maxDiscountPercent: 100,
        getConstraints: () => undefined, // No constraints for superusers
        canManageSchoolUsers: true,
        canViewCosts: true,
        canCancelSales: true,
        canApplyDiscount: true,
        canAdjustInventory: true,
        canManageAccounting: true,
        canApproveChanges: true,
        canManageProducts: true,
        canExportReports: true,
        canLiquidateCajaMenor: true,
        canCloseRegister: true,
        canAdjustBalance: true,
        canViewDailyFlow: true,
        canViewCajaMenor: true,
        canManageWorkforce: true,
      };
    }

    // Owner gets all permissions
    if (schoolRole?.role === 'owner') {
      return {
        hasPermission: () => true,
        hasAnyPermission: () => true,
        hasAllPermissions: () => true,
        permissions: new Set(['*']), // Symbolic "all"
        maxDiscountPercent: 100,
        getConstraints,
        canManageSchoolUsers: true,
        canViewCosts: true,
        canCancelSales: true,
        canApplyDiscount: true,
        canAdjustInventory: true,
        canManageAccounting: true,
        canApproveChanges: true,
        canManageProducts: true,
        canExportReports: true,
        canLiquidateCajaMenor: true,
        canCloseRegister: true,
        canAdjustBalance: true,
        canViewDailyFlow: true,
        canViewCajaMenor: true,
        canManageWorkforce: true,
      };
    }

    // Determine permissions: use backend-provided permissions if available,
    // otherwise fall back to system role defaults
    let permissions: Set<string>;
    let maxDiscountPercent: number;

    // If backend sent calculated permissions, use them directly
    // This handles both custom roles AND system roles with backend calculations
    if (schoolRole?.permissions && schoolRole.permissions.length > 0) {
      permissions = new Set(schoolRole.permissions);
      maxDiscountPercent = schoolRole.max_discount_percent || 0;
    }
    // Fallback: use local system role permissions table if role exists
    else if (schoolRole?.role) {
      permissions = SYSTEM_ROLE_PERMISSIONS[schoolRole.role] || new Set();
      maxDiscountPercent = SYSTEM_ROLE_MAX_DISCOUNT[schoolRole.role] || 0;
    }
    // No role and no permissions = no access
    else {
      return defaultResult;
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
      getConstraints,
      canManageSchoolUsers: false, // Only owner/superuser can manage users (handled above)
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
      // Cash micro-permission helpers
      canLiquidateCajaMenor: hasPermission('accounting.liquidate_caja_menor'),
      canCloseRegister: hasPermission('accounting.close_register'),
      canAdjustBalance: hasPermission('accounting.adjust_balance'),
      canViewDailyFlow: hasPermission('accounting.view_daily_flow'),
      canViewCajaMenor: hasPermission('accounting.view_caja_menor'),
      canManageWorkforce: hasAnyPermission('workforce.manage_shifts', 'workforce.manage_attendance'),
    };
  }, [user, currentSchool]);
}

/**
 * Component wrapper for permission-based rendering
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

/**
 * Hook to check amount constraints for a specific permission
 */
export function useAmountConstraint(permissionCode: string): {
  maxAmount: number | null | undefined;
  requiresApproval: boolean;
  validateAmount: (amount: number) => { allowed: boolean; needsApproval: boolean; message?: string };
} {
  const { getConstraints, hasPermission } = usePermissions();

  return useMemo(() => {
    const constraints = getConstraints(permissionCode);
    const hasPerm = hasPermission(permissionCode);

    const maxAmount = constraints?.max_amount;
    const requiresApproval = constraints?.requires_approval || false;

    const validateAmount = (amount: number) => {
      if (!hasPerm) {
        return { allowed: false, needsApproval: false, message: 'Sin permiso para esta operacion' };
      }

      if (maxAmount != null && amount > maxAmount) {
        if (requiresApproval) {
          return {
            allowed: true,
            needsApproval: true,
            message: `Monto $${amount.toLocaleString()} excede limite de $${maxAmount.toLocaleString()}. Requiere aprobacion.`,
          };
        }
        return {
          allowed: false,
          needsApproval: false,
          message: `Monto maximo permitido: $${maxAmount.toLocaleString()}`,
        };
      }

      if (requiresApproval) {
        return { allowed: true, needsApproval: true, message: 'Esta operacion requiere aprobacion.' };
      }

      return { allowed: true, needsApproval: false };
    };

    return { maxAmount, requiresApproval, validateAmount };
  }, [getConstraints, hasPermission, permissionCode]);
}

export default usePermissions;
