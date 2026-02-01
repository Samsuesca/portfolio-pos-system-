'use client';

/**
 * RequirePermission - Component wrapper for permission-based rendering
 *
 * Renders children only if the current user has the required permissions.
 * Supports multiple ways to check permissions:
 * - Single permission code
 * - Any of multiple permissions
 * - All of multiple permissions
 * - Minimum role level
 */
import type { ReactNode } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useUserRole, type UserRole } from '@/lib/hooks/useUserRole';

interface RequirePermissionProps {
  /** Single permission code to check (e.g., "sales.create") */
  permission?: string;

  /** Multiple permissions - user needs ANY of these */
  permissions?: string[];

  /** Multiple permissions - user needs ALL of these */
  allPermissions?: string[];

  /** Minimum role required (uses role hierarchy) */
  minRole?: UserRole;

  /** What to render if permission is denied (default: null/nothing) */
  fallback?: ReactNode;

  /** Content to render if permission is granted */
  children: ReactNode;
}

/**
 * Conditionally renders children based on user permissions
 *
 * @example
 * // Single permission
 * <RequirePermission permission="sales.create">
 *   <button>Nueva Venta</button>
 * </RequirePermission>
 *
 * @example
 * // Minimum role
 * <RequirePermission minRole="admin">
 *   <AccountingSection />
 * </RequirePermission>
 *
 * @example
 * // Any of multiple permissions
 * <RequirePermission permissions={["sales.edit", "sales.cancel"]}>
 *   <ActionButtons />
 * </RequirePermission>
 *
 * @example
 * // With fallback
 * <RequirePermission permission="sales.cancel" fallback={<span className="text-gray-400">Sin permiso</span>}>
 *   <button>Cancelar</button>
 * </RequirePermission>
 */
export function RequirePermission({
  permission,
  permissions,
  allPermissions,
  minRole,
  fallback = null,
  children,
}: RequirePermissionProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
  const { hasRoleOrHigher, isSuperuser } = useUserRole();

  // Superuser always has access
  if (isSuperuser) {
    return <>{children}</>;
  }

  // Check minimum role
  if (minRole && !hasRoleOrHigher(minRole)) {
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check any of multiple permissions
  if (permissions && permissions.length > 0 && !hasAnyPermission(...permissions)) {
    return <>{fallback}</>;
  }

  // Check all of multiple permissions
  if (allPermissions && allPermissions.length > 0 && !hasAllPermissions(...allPermissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook version for cases where component wrapper doesn't fit
 *
 * @example
 * const canCreate = useHasPermission("sales.create");
 * if (canCreate) { ... }
 */
export function useHasPermission(permission: string): boolean {
  const { hasPermission } = usePermissions();
  const { isSuperuser } = useUserRole();
  return isSuperuser || hasPermission(permission);
}

/**
 * Hook to check minimum role
 *
 * @example
 * const isAdmin = useHasMinRole("admin");
 */
export function useHasMinRole(minRole: UserRole): boolean {
  const { hasRoleOrHigher, isSuperuser } = useUserRole();
  return isSuperuser || hasRoleOrHigher(minRole);
}

export default RequirePermission;
