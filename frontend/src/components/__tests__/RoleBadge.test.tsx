import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RoleBadge, { getUserDisplayRole, hasMinimumRole, ROLE_HIERARCHY } from '../RoleBadge';

describe('RoleBadge', () => {
  const roles = [
    { role: 'viewer' as const, label: 'Visualizador' },
    { role: 'seller' as const, label: 'Vendedor' },
    { role: 'admin' as const, label: 'Administrador' },
    { role: 'owner' as const, label: 'Propietario' },
    { role: 'superuser' as const, label: 'Superusuario' },
  ];

  it.each(roles)('renders $role with label "$label"', ({ role, label }) => {
    render(<RoleBadge role={role} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('hides icon when showIcon=false', () => {
    const { container } = render(<RoleBadge role="admin" showIcon={false} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('hides label when showLabel=false', () => {
    render(<RoleBadge role="admin" showLabel={false} />);
    expect(screen.queryByText('Administrador')).not.toBeInTheDocument();
  });
});

describe('getUserDisplayRole', () => {
  it('returns superuser when isSuperuser is true', () => {
    expect(getUserDisplayRole(true)).toBe('superuser');
    expect(getUserDisplayRole(true, 'admin')).toBe('superuser');
  });

  it('returns schoolRole when not superuser', () => {
    expect(getUserDisplayRole(false, 'admin')).toBe('admin');
    expect(getUserDisplayRole(false, 'seller')).toBe('seller');
  });

  it('returns viewer as fallback when no schoolRole', () => {
    expect(getUserDisplayRole(false)).toBe('viewer');
    expect(getUserDisplayRole(false, null)).toBe('viewer');
  });
});

describe('hasMinimumRole', () => {
  it('returns true when user role meets required level', () => {
    expect(hasMinimumRole('admin', 'seller')).toBe(true);
    expect(hasMinimumRole('owner', 'admin')).toBe(true);
    expect(hasMinimumRole('seller', 'seller')).toBe(true);
  });

  it('returns false when user role is below required level', () => {
    expect(hasMinimumRole('seller', 'admin')).toBe(false);
    expect(hasMinimumRole('viewer', 'seller')).toBe(false);
  });
});

describe('ROLE_HIERARCHY', () => {
  it('has correct ordering', () => {
    expect(ROLE_HIERARCHY.viewer).toBeLessThan(ROLE_HIERARCHY.seller);
    expect(ROLE_HIERARCHY.seller).toBeLessThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeLessThan(ROLE_HIERARCHY.owner);
  });
});
