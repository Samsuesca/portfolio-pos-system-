/**
 * Hook for granular permission checks (Mobile)
 *
 * Uses backend-provided permissions from login response as primary source.
 * Falls back to permission registry cached from /permissions/registry.
 */
import { useMemo, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import {
  getSystemRolePermissions,
  getRoleMaxDiscount,
} from '../services/permissionRegistryService';

type SystemRole = 'viewer' | 'seller' | 'admin' | 'owner';

interface PermissionConstraints {
  max_amount?: number | null;
  requires_approval?: boolean;
  max_daily_count?: number | null;
}

export interface UsePermissionsResult {
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
  hasAllPermissions: (...codes: string[]) => boolean;
  permissions: Set<string>;
  maxDiscountPercent: number;
  getConstraints: (code: string) => PermissionConstraints | undefined;

  canViewSales: boolean;
  canCreateSales: boolean;
  canCancelSales: boolean;
  canApplyDiscount: boolean;
  canViewClients: boolean;
  canCreateClients: boolean;
  canViewOrders: boolean;
  canDeliverOrders: boolean;
  canViewInventory: boolean;
  canAdjustInventory: boolean;
  canViewAccounting: boolean;
  canViewCash: boolean;
  canViewExpenses: boolean;
  canCreateExpense: boolean;
  canPayExpense: boolean;
  canViewReceivables: boolean;
  canManageReceivables: boolean;
  canViewDailyFlow: boolean;
  canViewDashboard: boolean;
}

const DEFAULT_RESULT: UsePermissionsResult = {
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  permissions: new Set(),
  maxDiscountPercent: 0,
  getConstraints: () => undefined,
  canViewSales: false,
  canCreateSales: false,
  canCancelSales: false,
  canApplyDiscount: false,
  canViewClients: false,
  canCreateClients: false,
  canViewOrders: false,
  canDeliverOrders: false,
  canViewInventory: false,
  canAdjustInventory: false,
  canViewAccounting: false,
  canViewCash: false,
  canViewExpenses: false,
  canCreateExpense: false,
  canPayExpense: false,
  canViewReceivables: false,
  canManageReceivables: false,
  canViewDailyFlow: false,
  canViewDashboard: false,
};

const ALL_TRUE: UsePermissionsResult = {
  hasPermission: () => true,
  hasAnyPermission: () => true,
  hasAllPermissions: () => true,
  permissions: new Set(['*']),
  maxDiscountPercent: 100,
  getConstraints: () => undefined,
  canViewSales: true,
  canCreateSales: true,
  canCancelSales: true,
  canApplyDiscount: true,
  canViewClients: true,
  canCreateClients: true,
  canViewOrders: true,
  canDeliverOrders: true,
  canViewInventory: true,
  canAdjustInventory: true,
  canViewAccounting: true,
  canViewCash: true,
  canViewExpenses: true,
  canCreateExpense: true,
  canPayExpense: true,
  canViewReceivables: true,
  canManageReceivables: true,
  canViewDailyFlow: true,
  canViewDashboard: true,
};

export function usePermissions(): UsePermissionsResult {
  const user = useAuthStore((s) => s.user);
  const currentSchool = useSchoolStore((s) => s.currentSchool);

  return useMemo(() => {
    if (!user) return DEFAULT_RESULT;

    if (user.is_superuser) return ALL_TRUE;

    const schoolRole = currentSchool
      ? user.school_roles?.find((r) => r.school_id === currentSchool.id)
      : user.school_roles?.[0];

    if (!schoolRole) return DEFAULT_RESULT;

    if (schoolRole.role === 'owner') {
      const constraintsMap = schoolRole.constraints || {};
      return { ...ALL_TRUE, getConstraints: (code: string) => constraintsMap[code] as PermissionConstraints | undefined };
    }

    let permissions: Set<string>;
    let maxDiscountPercent: number;

    if (schoolRole.permissions && schoolRole.permissions.length > 0) {
      permissions = new Set(schoolRole.permissions);
      maxDiscountPercent = schoolRole.max_discount_percent || 0;
    } else if (schoolRole.role) {
      // Fallback to registry cache instead of hardcoded map
      permissions = getSystemRolePermissions(schoolRole.role);
      maxDiscountPercent = getRoleMaxDiscount(schoolRole.role);
    } else {
      return DEFAULT_RESULT;
    }

    const constraintsMap = schoolRole.constraints || {};
    const hasPermission = (code: string) => permissions.has(code);
    const hasAnyPermission = (...codes: string[]) => codes.some((c) => permissions.has(c));
    const hasAllPermissions = (...codes: string[]) => codes.every((c) => permissions.has(c));

    return {
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      permissions,
      maxDiscountPercent,
      getConstraints: (code: string) => constraintsMap[code] as PermissionConstraints | undefined,

      canViewSales: hasPermission('sales.view'),
      canCreateSales: hasPermission('sales.create'),
      canCancelSales: hasPermission('sales.cancel'),
      canApplyDiscount: hasPermission('sales.apply_discount'),
      canViewClients: hasPermission('clients.view'),
      canCreateClients: hasPermission('clients.create'),
      canViewOrders: hasPermission('orders.view'),
      canDeliverOrders: hasPermission('orders.deliver'),
      canViewInventory: hasPermission('inventory.view'),
      canAdjustInventory: hasPermission('inventory.adjust'),
      canViewAccounting: hasAnyPermission(
        'accounting.view_cash', 'accounting.view_expenses',
        'accounting.view_receivables', 'accounting.view_daily_flow',
      ),
      canViewCash: hasAnyPermission('accounting.view_cash', 'accounting.view_global_balances'),
      canViewExpenses: hasPermission('accounting.view_expenses'),
      canCreateExpense: hasPermission('accounting.create_expense'),
      canPayExpense: hasPermission('accounting.pay_expense'),
      canViewReceivables: hasPermission('accounting.view_receivables'),
      canManageReceivables: hasPermission('accounting.manage_receivables'),
      canViewDailyFlow: hasPermission('accounting.view_daily_flow'),
      canViewDashboard: hasPermission('reports.dashboard'),
    };
  }, [user, currentSchool]);
}

export function useDiscountPermission(): {
  canApplyDiscount: boolean;
  maxPercent: number;
  validateDiscount: (percent: number) => boolean;
} {
  const { canApplyDiscount, maxDiscountPercent } = usePermissions();

  const validateDiscount = useCallback(
    (percent: number) => canApplyDiscount && percent <= maxDiscountPercent,
    [canApplyDiscount, maxDiscountPercent]
  );

  return { canApplyDiscount, maxPercent: maxDiscountPercent, validateDiscount };
}

export default usePermissions;
