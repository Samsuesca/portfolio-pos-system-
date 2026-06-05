/**
 * Hook for granular permission checks
 *
 * Uses backend-provided permissions from the login response as primary source.
 * Falls back to the permission registry (fetched from /permissions/registry
 * and cached in localStorage) for system role defaults.
 */
import { useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import type { PermissionConstraints } from '../types/api';
import {
  getSystemRolePermissions,
  getRoleMaxDiscount,
} from '../services/permissionRegistryService';

export interface UsePermissionsResult {
  hasPermission: (permissionCode: string) => boolean;
  hasAnyPermission: (...permissionCodes: string[]) => boolean;
  hasAllPermissions: (...permissionCodes: string[]) => boolean;
  permissions: Set<string>;
  maxDiscountPercent: number;
  getConstraints: (permissionCode: string) => PermissionConstraints | undefined;
  canManageSchoolUsers: boolean;

  canViewCosts: boolean;
  canEditCosts: boolean;
  canManageCostTemplates: boolean;
  canCancelSales: boolean;
  canApplyDiscount: boolean;
  canAdjustInventory: boolean;
  canManageAccounting: boolean;
  canApproveChanges: boolean;
  canManageProducts: boolean;
  canExportReports: boolean;

  canLiquidateCajaMenor: boolean;
  canCloseRegister: boolean;
  canAdjustBalance: boolean;
  canViewDailyFlow: boolean;
  canViewCajaMenor: boolean;

  canManageWorkforce: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { user } = useAuthStore();
  const { currentSchool } = useSchoolStore();

  return useMemo(() => {
    const noConstraints = (_code: string) => undefined;

    const defaultResult: UsePermissionsResult = {
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      permissions: new Set(),
      maxDiscountPercent: 0,
      getConstraints: noConstraints,
      canManageSchoolUsers: false,
      canViewCosts: false,
      canEditCosts: false,
      canManageCostTemplates: false,
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

    const schoolRole = user.school_roles?.find(
      (r) => r.school_id === currentSchool.id
    );

    const constraintsMap = schoolRole?.constraints || {};
    const getConstraints = (code: string) => constraintsMap[code];

    // Superusers get all permissions
    if (user.is_superuser) {
      return {
        hasPermission: () => true,
        hasAnyPermission: () => true,
        hasAllPermissions: () => true,
        permissions: new Set(['*']),
        maxDiscountPercent: 100,
        getConstraints: () => undefined,
        canManageSchoolUsers: true,
        canViewCosts: true,
        canEditCosts: true,
        canManageCostTemplates: true,
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
        permissions: new Set(['*']),
        maxDiscountPercent: 100,
        getConstraints,
        canManageSchoolUsers: true,
        canViewCosts: true,
        canEditCosts: true,
        canManageCostTemplates: true,
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
    // otherwise fall back to registry-cached system role defaults
    let permissions: Set<string>;
    let maxDiscountPercent: number;

    if (schoolRole?.permissions && schoolRole.permissions.length > 0) {
      permissions = new Set(schoolRole.permissions);
      maxDiscountPercent = schoolRole.max_discount_percent || 0;
    } else if (schoolRole?.role) {
      permissions = getSystemRolePermissions(schoolRole.role);
      maxDiscountPercent = getRoleMaxDiscount(schoolRole.role);
    } else {
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
      canManageSchoolUsers: false,
      canViewCosts: hasAnyPermission('sales.view_cost', 'inventory.view_cost'),
      canEditCosts: hasPermission('products.set_cost'),
      canManageCostTemplates: hasPermission('costs.manage_templates'),
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
