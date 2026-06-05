import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePermissions,
  usePermissionCheck,
  useDiscountPermission,
  useAmountConstraint,
} from './usePermissions';

vi.mock('../stores/authStore', () => ({ useAuthStore: vi.fn() }));
vi.mock('../stores/schoolStore', () => ({ useSchoolStore: vi.fn() }));
vi.mock('../services/permissionRegistryService', () => ({
  getSystemRolePermissions: vi.fn(),
  getRoleMaxDiscount: vi.fn(),
}));

import { useAuthStore } from '../stores/authStore';
import { useSchoolStore } from '../stores/schoolStore';
import { getSystemRolePermissions, getRoleMaxDiscount } from '../services/permissionRegistryService';

const authMock = vi.mocked(useAuthStore as unknown as (s?: any) => any);
const schoolMock = vi.mocked(useSchoolStore as unknown as (s?: any) => any);
const sysPermsMock = vi.mocked(getSystemRolePermissions);
const maxDiscountMock = vi.mocked(getRoleMaxDiscount);

const school = { id: 'school-1', name: 'Test' };

function setupMocks(user: any, currentSchool: any) {
  authMock.mockReturnValue({ user });
  schoolMock.mockReturnValue({ currentSchool });
}

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sysPermsMock.mockReturnValue(new Set<string>());
    maxDiscountMock.mockReturnValue(0);
  });

  describe('no user or no school', () => {
    it('returns all-false defaults when user is null', () => {
      setupMocks(null, school);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.permissions.size).toBe(0);
      expect(result.current.hasPermission('sales.create')).toBe(false);
      expect(result.current.canManageAccounting).toBe(false);
    });

    it('returns all-false defaults when currentSchool is null', () => {
      setupMocks({ is_superuser: false, school_roles: [] }, null);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('sales.create')).toBe(false);
    });
  });

  describe('superuser', () => {
    it('grants all permissions', () => {
      setupMocks({ is_superuser: true, school_roles: [] }, school);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('anything')).toBe(true);
      expect(result.current.hasAnyPermission('x', 'y')).toBe(true);
      expect(result.current.hasAllPermissions('x', 'y')).toBe(true);
      expect(result.current.maxDiscountPercent).toBe(100);
      expect(result.current.canManageAccounting).toBe(true);
      expect(result.current.canViewCosts).toBe(true);
      expect(result.current.canManageWorkforce).toBe(true);
    });

    it('permissions Set contains wildcard *', () => {
      setupMocks({ is_superuser: true, school_roles: [] }, school);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.permissions.has('*')).toBe(true);
    });
  });

  describe('owner role', () => {
    it('grants all permissions for owner role', () => {
      setupMocks(
        { is_superuser: false, school_roles: [{ school_id: 'school-1', role: 'owner', permissions: [] }] },
        school
      );
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('anything')).toBe(true);
      expect(result.current.canManageSchoolUsers).toBe(true);
      expect(result.current.maxDiscountPercent).toBe(100);
    });
  });

  describe('custom backend permissions', () => {
    it('uses backend permissions when schoolRole.permissions is populated', () => {
      setupMocks(
        {
          is_superuser: false,
          school_roles: [{
            school_id: 'school-1',
            role: 'admin',
            permissions: ['sales.create', 'sales.view_cost'],
            max_discount_percent: 15,
          }],
        },
        school
      );
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('sales.create')).toBe(true);
      expect(result.current.hasPermission('products.delete')).toBe(false);
      expect(result.current.canViewCosts).toBe(true); // has sales.view_cost
      expect(result.current.maxDiscountPercent).toBe(15);
    });

    it('falls back to registry when backend permissions array is empty', () => {
      sysPermsMock.mockReturnValue(new Set(['sales.cancel', 'inventory.adjust']));
      maxDiscountMock.mockReturnValue(20);
      setupMocks(
        {
          is_superuser: false,
          school_roles: [{
            school_id: 'school-1',
            role: 'admin',
            permissions: [], // empty → use registry
            max_discount_percent: 0,
          }],
        },
        school
      );
      const { result } = renderHook(() => usePermissions());
      expect(sysPermsMock).toHaveBeenCalledWith('admin');
      expect(result.current.hasPermission('sales.cancel')).toBe(true);
      expect(result.current.maxDiscountPercent).toBe(20);
    });
  });

  describe('no schoolRole', () => {
    it('returns defaults when user has no role for current school', () => {
      setupMocks(
        { is_superuser: false, school_roles: [{ school_id: 'other-school', role: 'admin' }] },
        school
      );
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasPermission('sales.create')).toBe(false);
    });
  });

  describe('derived permission flags', () => {
    function setupWithPermissions(perms: string[]) {
      setupMocks(
        {
          is_superuser: false,
          school_roles: [{ school_id: 'school-1', role: 'admin', permissions: perms }],
        },
        school
      );
    }

    it('canViewCosts: true if has sales.view_cost OR inventory.view_cost', () => {
      setupWithPermissions(['inventory.view_cost']);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canViewCosts).toBe(true);
    });

    it('canCancelSales: true if has sales.cancel', () => {
      setupWithPermissions(['sales.cancel']);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canCancelSales).toBe(true);
    });

    it('canManageAccounting: true if has any accounting create/manage permission', () => {
      setupWithPermissions(['accounting.manage_receivables']);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canManageAccounting).toBe(true);
    });

    it('canManageProducts: true if has any products CRUD permission', () => {
      setupWithPermissions(['products.edit']);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canManageProducts).toBe(true);
    });

    it('canApproveChanges: true if has changes.approve or changes.reject', () => {
      setupWithPermissions(['changes.reject']);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canApproveChanges).toBe(true);
    });

    it('canManageWorkforce: true if has workforce permission', () => {
      setupWithPermissions(['workforce.manage_shifts']);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canManageWorkforce).toBe(true);
    });

    it('canManageSchoolUsers: always false for non-owner/non-superuser', () => {
      setupWithPermissions(['sales.create', 'users.manage']);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canManageSchoolUsers).toBe(false);
    });
  });

  describe('hasAnyPermission and hasAllPermissions', () => {
    beforeEach(() => {
      setupMocks(
        {
          is_superuser: false,
          school_roles: [{ school_id: 'school-1', role: 'admin', permissions: ['sales.create', 'products.view'] }],
        },
        school
      );
    });

    it('hasAnyPermission returns true when at least one matches', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission('sales.create', 'accounting.view')).toBe(true);
    });

    it('hasAnyPermission returns false when none match', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAnyPermission('accounting.view', 'reports.export')).toBe(false);
    });

    it('hasAllPermissions returns true when all match', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions('sales.create', 'products.view')).toBe(true);
    });

    it('hasAllPermissions returns false when any is missing', () => {
      const { result } = renderHook(() => usePermissions());
      expect(result.current.hasAllPermissions('sales.create', 'accounting.view')).toBe(false);
    });
  });
});

// ─── usePermissionCheck ───────────────────────────────────────────────────────

describe('usePermissionCheck', () => {
  it('returns true when permission is granted', () => {
    authMock.mockReturnValue({ user: { is_superuser: true, school_roles: [] } });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => usePermissionCheck('sales.create'));
    expect(result.current).toBe(true);
  });

  it('returns false when permission is not granted', () => {
    authMock.mockReturnValue({ user: null });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => usePermissionCheck('sales.create'));
    expect(result.current).toBe(false);
  });
});

// ─── useDiscountPermission ────────────────────────────────────────────────────

describe('useDiscountPermission', () => {
  it('validateDiscount returns false when canApplyDiscount is false', () => {
    authMock.mockReturnValue({ user: null });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => useDiscountPermission());
    expect(result.current.validateDiscount(5)).toBe(false);
  });

  it('validateDiscount returns true when within maxPercent', () => {
    authMock.mockReturnValue({
      user: {
        is_superuser: false,
        school_roles: [{
          school_id: 'school-1', role: 'admin',
          permissions: ['sales.apply_discount'],
          max_discount_percent: 20,
        }],
      },
    });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => useDiscountPermission());
    expect(result.current.validateDiscount(15)).toBe(true);
    expect(result.current.validateDiscount(25)).toBe(false);
    expect(result.current.maxPercent).toBe(20);
  });
});

// ─── useAmountConstraint ──────────────────────────────────────────────────────

describe('useAmountConstraint', () => {
  it('returns allowed: false when no permission', () => {
    authMock.mockReturnValue({ user: null });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => useAmountConstraint('accounting.create_expense'));
    expect(result.current.validateAmount(1000).allowed).toBe(false);
  });

  it('returns allowed: true when has permission and no constraints', () => {
    authMock.mockReturnValue({
      user: {
        is_superuser: false,
        school_roles: [{
          school_id: 'school-1',
          role: 'admin',
          permissions: ['accounting.create_expense'],
        }],
      },
    });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => useAmountConstraint('accounting.create_expense'));
    const { allowed, needsApproval } = result.current.validateAmount(500);
    expect(allowed).toBe(true);
    expect(needsApproval).toBe(false);
  });

  it('returns needsApproval: true when amount exceeds limit with requires_approval', () => {
    authMock.mockReturnValue({
      user: {
        is_superuser: false,
        school_roles: [{
          school_id: 'school-1',
          role: 'admin',
          permissions: ['accounting.create_expense'],
          constraints: {
            'accounting.create_expense': { max_amount: 1000, requires_approval: true },
          },
        }],
      },
    });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => useAmountConstraint('accounting.create_expense'));
    const { allowed, needsApproval } = result.current.validateAmount(2000);
    expect(allowed).toBe(true);
    expect(needsApproval).toBe(true);
  });

  it('returns needsApproval: true when requires_approval is set even without exceeding limit', () => {
    authMock.mockReturnValue({
      user: {
        is_superuser: false,
        school_roles: [{
          school_id: 'school-1',
          role: 'admin',
          permissions: ['accounting.create_expense'],
          constraints: {
            'accounting.create_expense': { requires_approval: true },
          },
        }],
      },
    });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => useAmountConstraint('accounting.create_expense'));
    const { allowed, needsApproval, message } = result.current.validateAmount(500);
    expect(allowed).toBe(true);
    expect(needsApproval).toBe(true);
    expect(message).toContain('aprobacion');
  });

  it('returns allowed: false when amount exceeds limit without requires_approval', () => {
    authMock.mockReturnValue({
      user: {
        is_superuser: false,
        school_roles: [{
          school_id: 'school-1',
          role: 'admin',
          permissions: ['accounting.create_expense'],
          constraints: {
            'accounting.create_expense': { max_amount: 1000, requires_approval: false },
          },
        }],
      },
    });
    schoolMock.mockReturnValue({ currentSchool: school });
    const { result } = renderHook(() => useAmountConstraint('accounting.create_expense'));
    const { allowed } = result.current.validateAmount(2000);
    expect(allowed).toBe(false);
  });
});
