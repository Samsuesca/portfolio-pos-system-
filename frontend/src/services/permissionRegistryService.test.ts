import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

vi.mock('../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '../utils/api-client';
import {
  getStoredVersion,
  getCachedRegistry,
  getSystemRolePermissions,
  getRoleMaxDiscount,
  isOwnerRole,
  fetchPermissionRegistry,
  checkPermissionsRefresh,
  refreshRegistryIfStale,
  type PermissionRegistry,
} from './permissionRegistryService';

const apiClientMock = vi.mocked(apiClient);

const mockRegistry: PermissionRegistry = {
  version: 'v42',
  permissions: [
    { code: 'sales.create', category: 'sales', name: 'Create Sales', description: null, is_sensitive: false },
    { code: 'accounting.view', category: 'accounting', name: 'View Accounting', description: null, is_sensitive: true },
  ],
  system_roles: {
    owner: null, // owner gets all permissions
    admin: ['sales.create', 'accounting.view'],
    seller: ['sales.create'],
    viewer: [],
  },
  role_constraints: {},
  role_max_discount: {
    owner: 100,
    admin: 20,
    seller: 10,
    viewer: 0,
  },
};

describe('permissionRegistryService — empty state (before fetch)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getStoredVersion returns null when localStorage is empty', () => {
    expect(getStoredVersion()).toBeNull();
  });

  it('fetchPermissionRegistry throws when API fails and no localStorage cache', async () => {
    // This must run before any successful fetch populates _memoryCache
    localStorage.clear();
    apiClientMock.get.mockRejectedValueOnce(new Error('Network error'));
    await expect(fetchPermissionRegistry()).rejects.toThrow('No se pudo cargar');
  });

  it('loadFromStorage returns null when localStorage has malformed JSON', () => {
    localStorage.setItem('permission_registry', '{invalid json!!!');
    const registry = getCachedRegistry();
    expect(registry).toBeNull();
  });
});

describe('permissionRegistryService — after registry is loaded', () => {
  beforeAll(async () => {
    localStorage.clear();
    apiClientMock.get.mockResolvedValueOnce({ data: mockRegistry, status: 200 });
    await fetchPermissionRegistry();
  });

  describe('getCachedRegistry', () => {
    it('returns the registry from memory cache after fetch', () => {
      const registry = getCachedRegistry();
      expect(registry).not.toBeNull();
      expect(registry?.version).toBe('v42');
    });
  });

  describe('getStoredVersion', () => {
    it('returns the version stored in localStorage', () => {
      expect(getStoredVersion()).toBe('v42');
    });
  });

  describe('getSystemRolePermissions', () => {
    it('returns empty Set for owner (null means wildcard, handled separately)', () => {
      const perms = getSystemRolePermissions('owner');
      expect(perms).toBeInstanceOf(Set);
      expect(perms.size).toBe(0); // null entry → empty Set
    });

    it('returns permission set for admin', () => {
      const perms = getSystemRolePermissions('admin');
      expect(perms.has('sales.create')).toBe(true);
      expect(perms.has('accounting.view')).toBe(true);
    });

    it('returns correct subset for seller', () => {
      const perms = getSystemRolePermissions('seller');
      expect(perms.has('sales.create')).toBe(true);
      expect(perms.has('accounting.view')).toBe(false);
    });

    it('returns empty Set for viewer', () => {
      expect(getSystemRolePermissions('viewer').size).toBe(0);
    });

    it('returns empty Set for unknown role', () => {
      expect(getSystemRolePermissions('nonexistent').size).toBe(0);
    });
  });

  describe('getRoleMaxDiscount', () => {
    it('returns correct discount for owner', () => {
      expect(getRoleMaxDiscount('owner')).toBe(100);
    });

    it('returns correct discount for seller', () => {
      expect(getRoleMaxDiscount('seller')).toBe(10);
    });

    it('returns 0 for unknown role', () => {
      expect(getRoleMaxDiscount('unknown')).toBe(0);
    });
  });

  describe('isOwnerRole', () => {
    it('returns true for owner (null entry in system_roles)', () => {
      expect(isOwnerRole('owner')).toBe(true);
    });

    it('returns false for admin', () => {
      expect(isOwnerRole('admin')).toBe(false);
    });

    it('returns false for seller', () => {
      expect(isOwnerRole('seller')).toBe(false);
    });
  });
});

describe('fetchPermissionRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns the registry on success and saves to localStorage', async () => {
    apiClientMock.get.mockResolvedValueOnce({ data: mockRegistry, status: 200 });
    const result = await fetchPermissionRegistry();
    expect(result.version).toBe('v42');
    expect(localStorage.getItem('permission_registry_version')).toBe('v42');
  });

  it('falls back to localStorage cache when API fails', async () => {
    // Pre-populate localStorage
    localStorage.setItem('permission_registry', JSON.stringify(mockRegistry));
    localStorage.setItem('permission_registry_version', 'v42');

    apiClientMock.get.mockRejectedValueOnce(new Error('Network error'));
    const result = await fetchPermissionRegistry();
    expect(result.version).toBe('v42');
  });

});

describe('checkPermissionsRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns response on success', async () => {
    const mockResponse = { status: 'current' as const };
    apiClientMock.get.mockResolvedValueOnce({ data: mockResponse, status: 200 });
    const result = await checkPermissionsRefresh(42);
    expect(result?.status).toBe('current');
  });

  it('returns null on API error (silent fail)', async () => {
    apiClientMock.get.mockRejectedValueOnce(new Error('Unauthorized'));
    const result = await checkPermissionsRefresh(42);
    expect(result).toBeNull();
  });
});

describe('refreshRegistryIfStale', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('updates cache when version differs from stored', async () => {
    localStorage.setItem('permission_registry_version', 'v1');
    const newRegistry = { ...mockRegistry, version: 'v2' };
    apiClientMock.get.mockResolvedValueOnce({ data: newRegistry, status: 200 });

    await refreshRegistryIfStale();

    expect(localStorage.getItem('permission_registry_version')).toBe('v2');
  });

  it('does not update storage when version is current', async () => {
    localStorage.setItem('permission_registry_version', 'v42');
    apiClientMock.get.mockResolvedValueOnce({ data: mockRegistry, status: 200 });

    await refreshRegistryIfStale();

    // version stays 'v42' — no change written
    expect(localStorage.getItem('permission_registry_version')).toBe('v42');
  });

  it('silently fails on API error', async () => {
    apiClientMock.get.mockRejectedValueOnce(new Error('Network'));
    await expect(refreshRegistryIfStale()).resolves.toBeUndefined();
  });
});
