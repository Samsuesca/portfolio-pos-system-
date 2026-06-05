import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RequirePermission, useHasPermission, useHasMinRole } from '../RequirePermission';
import { renderHook } from '@testing-library/react';
import { useUserRole } from '../../hooks/useUserRole';

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: vi.fn().mockReturnValue({
    hasPermission: vi.fn((p: string) => p === 'sales.create'),
    hasAnyPermission: vi.fn((...ps: string[]) => ps.includes('sales.create')),
    hasAllPermissions: vi.fn((...ps: string[]) => ps.every(p => p === 'sales.create')),
  }),
}));

vi.mock('../../hooks/useUserRole', () => ({
  useUserRole: vi.fn().mockReturnValue({
    hasRoleOrHigher: vi.fn((role: string) => role === 'seller' || role === 'viewer'),
    isSuperuser: false,
  }),
}));

describe('RequirePermission', () => {
  it('renders children when user has single permission', () => {
    render(
      <RequirePermission permission="sales.create">
        <span>Allowed</span>
      </RequirePermission>
    );
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  it('renders fallback when user lacks single permission', () => {
    render(
      <RequirePermission permission="admin.manage" fallback={<span>Denied</span>}>
        <span>Secret</span>
      </RequirePermission>
    );
    expect(screen.getByText('Denied')).toBeInTheDocument();
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
  });

  it('renders nothing (default fallback) when permission denied', () => {
    const { container } = render(
      <RequirePermission permission="admin.manage">
        <span>Secret</span>
      </RequirePermission>
    );
    expect(screen.queryByText('Secret')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  it('renders children when user has any of listed permissions', () => {
    render(
      <RequirePermission permissions={['sales.create', 'sales.edit']}>
        <span>Allowed</span>
      </RequirePermission>
    );
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  it('renders fallback when user has none of listed permissions', () => {
    render(
      <RequirePermission permissions={['admin.manage', 'admin.delete']} fallback={<span>No</span>}>
        <span>Yes</span>
      </RequirePermission>
    );
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('renders children when user has minimum role', () => {
    render(
      <RequirePermission minRole="seller">
        <span>Seller Content</span>
      </RequirePermission>
    );
    expect(screen.getByText('Seller Content')).toBeInTheDocument();
  });

  it('renders fallback when user lacks minimum role', () => {
    render(
      <RequirePermission minRole="admin" fallback={<span>Not Admin</span>}>
        <span>Admin Content</span>
      </RequirePermission>
    );
    expect(screen.getByText('Not Admin')).toBeInTheDocument();
  });
});

describe('RequirePermission — superuser override', () => {
  it('renders children for superuser regardless of permission', () => {
    vi.mocked(useUserRole).mockReturnValue({
      hasRoleOrHigher: vi.fn(() => false),
      isSuperuser: true,
    } as any);

    render(
      <RequirePermission permission="admin.manage">
        <span>Super Access</span>
      </RequirePermission>
    );
    expect(screen.getByText('Super Access')).toBeInTheDocument();

    // Reset
    vi.mocked(useUserRole).mockReturnValue({
      hasRoleOrHigher: vi.fn((role: string) => role === 'seller' || role === 'viewer'),
      isSuperuser: false,
    } as any);
  });
});

describe('useHasPermission', () => {
  it('returns true for allowed permission', () => {
    const { result } = renderHook(() => useHasPermission('sales.create'));
    expect(result.current).toBe(true);
  });

  it('returns false for denied permission', () => {
    const { result } = renderHook(() => useHasPermission('admin.manage'));
    expect(result.current).toBe(false);
  });
});

describe('useHasMinRole', () => {
  it('returns true for sufficient role', () => {
    const { result } = renderHook(() => useHasMinRole('seller'));
    expect(result.current).toBe(true);
  });

  it('returns false for insufficient role', () => {
    const { result } = renderHook(() => useHasMinRole('admin'));
    expect(result.current).toBe(false);
  });
});
