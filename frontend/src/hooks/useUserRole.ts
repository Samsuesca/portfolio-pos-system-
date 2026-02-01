/**
 * Hook for getting user's role and permissions for the current school
 */
import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import type { UserRole } from '../types/api';
import {
  ROLE_HIERARCHY,
  canManageUsers,
  canAccessAccounting,
  canModifyInventory,
  canCreateSales,
  canDeleteRecords,
  canAccessAlterations,
} from '../types/api';

interface UseUserRoleResult {
  // Current role for selected school
  role: UserRole | null;

  // Is the user a superuser (bypasses all role checks)
  isSuperuser: boolean;

  // Permission checks
  canManageUsers: boolean;
  canAccessAccounting: boolean;
  canModifyInventory: boolean;
  canCreateSales: boolean;
  canDeleteRecords: boolean;
  canAccessAlterations: boolean;

  // Role level check
  hasRoleOrHigher: (minRole: UserRole) => boolean;
}

export function useUserRole(): UseUserRoleResult {
  const { user } = useAuthStore();
  const { currentSchool } = useSchoolStore();

  return useMemo(() => {
    // If superuser, grant all permissions
    if (user?.is_superuser) {
      return {
        role: 'owner' as UserRole,
        isSuperuser: true,
        canManageUsers: true,
        canAccessAccounting: true,
        canModifyInventory: true,
        canCreateSales: true,
        canDeleteRecords: true,
        canAccessAlterations: true,
        hasRoleOrHigher: () => true,
      };
    }

    // Find user's role for current school
    const schoolRole = user?.school_roles?.find(
      (r) => r.school_id === currentSchool?.id
    );
    const role = schoolRole?.role || null;

    return {
      role,
      isSuperuser: false,
      canManageUsers: canManageUsers(role ?? undefined),
      canAccessAccounting: canAccessAccounting(role ?? undefined),
      canModifyInventory: canModifyInventory(role ?? undefined),
      canCreateSales: canCreateSales(role ?? undefined),
      canDeleteRecords: canDeleteRecords(role ?? undefined),
      canAccessAlterations: canAccessAlterations(role ?? undefined),
      hasRoleOrHigher: (minRole: UserRole) => {
        if (!role) return false;
        return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole];
      },
    };
  }, [user, currentSchool]);
}

/**
 * Get role display name in Spanish
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    owner: 'Propietario',
    admin: 'Administrador',
    seller: 'Vendedor',
    viewer: 'Visualizador',
  };
  return names[role] || role;
}

/**
 * Get role badge color classes
 */
export function getRoleBadgeColor(role: UserRole): string {
  const colors: Record<UserRole, string> = {
    owner: 'bg-purple-100 text-purple-800',
    admin: 'bg-blue-100 text-blue-800',
    seller: 'bg-green-100 text-green-800',
    viewer: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}
