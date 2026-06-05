import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserRole, getRoleDisplayName, getRoleBadgeColor } from './useUserRole';

vi.mock('../stores/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../stores/schoolStore', () => ({
  useSchoolStore: vi.fn(),
}));

import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';

const useAuthStoreMock = vi.mocked(useAuthStore as unknown as (s?: any) => any);
const useSchoolStoreMock = vi.mocked(useSchoolStore as unknown as (s?: any) => any);

const school = { id: 'school-1', name: 'Test School' };

function setupMocks(user: any, currentSchool: any) {
  useAuthStoreMock.mockReturnValue({ user });
  useSchoolStoreMock.mockReturnValue({ currentSchool });
}

describe('useUserRole', () => {
  describe('superuser', () => {
    it('grants all permissions when user is_superuser', () => {
      setupMocks({ is_superuser: true, school_roles: [] }, school);
      const { result } = renderHook(() => useUserRole());

      expect(result.current.isSuperuser).toBe(true);
      expect(result.current.role).toBe('owner');
      expect(result.current.canManageUsers).toBe(true);
      expect(result.current.canAccessAccounting).toBe(true);
      expect(result.current.canModifyInventory).toBe(true);
      expect(result.current.canCreateSales).toBe(true);
      expect(result.current.canDeleteRecords).toBe(true);
      expect(result.current.canAccessAlterations).toBe(true);
    });

    it('hasRoleOrHigher always returns true for superuser', () => {
      setupMocks({ is_superuser: true, school_roles: [] }, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.hasRoleOrHigher('owner')).toBe(true);
      expect(result.current.hasRoleOrHigher('viewer')).toBe(true);
    });
  });

  describe('owner role', () => {
    const user = {
      is_superuser: false,
      school_roles: [{ school_id: 'school-1', role: 'owner' }],
    };

    it('canManageUsers is true for owner', () => {
      setupMocks(user, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.canManageUsers).toBe(true);
      expect(result.current.canAccessAccounting).toBe(true);
      expect(result.current.canModifyInventory).toBe(true);
      expect(result.current.canCreateSales).toBe(true);
      expect(result.current.isSuperuser).toBe(false);
      expect(result.current.role).toBe('owner');
    });
  });

  describe('admin role', () => {
    const user = {
      is_superuser: false,
      school_roles: [{ school_id: 'school-1', role: 'admin' }],
    };

    it('cannot manage users but can access accounting', () => {
      setupMocks(user, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.canManageUsers).toBe(false);
      expect(result.current.canAccessAccounting).toBe(true);
      expect(result.current.canModifyInventory).toBe(true);
      expect(result.current.canCreateSales).toBe(true);
      expect(result.current.role).toBe('admin');
    });
  });

  describe('seller role', () => {
    const user = {
      is_superuser: false,
      school_roles: [{ school_id: 'school-1', role: 'seller' }],
    };

    it('can create sales but cannot access accounting', () => {
      setupMocks(user, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.canCreateSales).toBe(true);
      expect(result.current.canManageUsers).toBe(false);
      expect(result.current.canAccessAccounting).toBe(false);
      expect(result.current.canModifyInventory).toBe(false);
      expect(result.current.role).toBe('seller');
    });
  });

  describe('viewer role', () => {
    const user = {
      is_superuser: false,
      school_roles: [{ school_id: 'school-1', role: 'viewer' }],
    };

    it('cannot do anything except view', () => {
      setupMocks(user, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.canManageUsers).toBe(false);
      expect(result.current.canCreateSales).toBe(false);
      expect(result.current.canAccessAccounting).toBe(false);
      expect(result.current.role).toBe('viewer');
    });
  });

  describe('no school selected', () => {
    it('returns null role and false permissions when no school', () => {
      setupMocks(
        { is_superuser: false, school_roles: [{ school_id: 'school-1', role: 'owner' }] },
        null
      );
      const { result } = renderHook(() => useUserRole());
      expect(result.current.role).toBeNull();
      expect(result.current.canManageUsers).toBe(false);
      expect(result.current.canCreateSales).toBe(false);
    });
  });

  describe('no user', () => {
    it('returns null role when user is null', () => {
      setupMocks(null, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.role).toBeNull();
      expect(result.current.isSuperuser).toBe(false);
    });
  });

  describe('hasRoleOrHigher', () => {
    const user = {
      is_superuser: false,
      school_roles: [{ school_id: 'school-1', role: 'admin' }],
    };

    it('returns true when user role meets minimum', () => {
      setupMocks(user, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.hasRoleOrHigher('seller')).toBe(true);
      expect(result.current.hasRoleOrHigher('admin')).toBe(true);
    });

    it('returns false when user role is below minimum', () => {
      setupMocks(user, school);
      const { result } = renderHook(() => useUserRole());
      expect(result.current.hasRoleOrHigher('owner')).toBe(false);
    });

    it('returns false when no role', () => {
      setupMocks(
        { is_superuser: false, school_roles: [] },
        school
      );
      const { result } = renderHook(() => useUserRole());
      expect(result.current.hasRoleOrHigher('viewer')).toBe(false);
    });
  });
});

// ─── getRoleDisplayName ───────────────────────────────────────────────────────

describe('getRoleDisplayName', () => {
  it('returns Spanish name for owner', () => {
    expect(getRoleDisplayName('owner')).toBe('Propietario');
  });

  it('returns Spanish name for admin', () => {
    expect(getRoleDisplayName('admin')).toBe('Administrador');
  });

  it('returns Spanish name for seller', () => {
    expect(getRoleDisplayName('seller')).toBe('Vendedor');
  });

  it('returns Spanish name for viewer', () => {
    expect(getRoleDisplayName('viewer')).toBe('Visualizador');
  });

  it('returns raw role string for unknown role', () => {
    expect(getRoleDisplayName('unknown_role' as any)).toBe('unknown_role');
  });
});

// ─── getRoleBadgeColor ────────────────────────────────────────────────────────

describe('getRoleBadgeColor', () => {
  it('returns purple classes for owner', () => {
    expect(getRoleBadgeColor('owner')).toContain('purple');
  });

  it('returns brand classes for admin', () => {
    expect(getRoleBadgeColor('admin')).toContain('brand');
  });

  it('returns emerald classes for seller', () => {
    expect(getRoleBadgeColor('seller')).toContain('emerald');
  });

  it('returns stone classes for viewer', () => {
    expect(getRoleBadgeColor('viewer')).toContain('stone');
  });

  it('returns stone fallback for unknown role', () => {
    expect(getRoleBadgeColor('unknown_role' as any)).toContain('stone');
  });
});
