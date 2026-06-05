import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

let registryModule: typeof import('../permissionRegistryService');

const mockRegistry = {
  permissions: [
    { code: 'sales.view', category: 'sales', name: 'Ver Ventas', description: null, is_sensitive: false },
    { code: 'sales.create', category: 'sales', name: 'Crear Ventas', description: null, is_sensitive: false },
  ],
  system_roles: {
    viewer: ['sales.view'],
    seller: ['sales.view', 'sales.create'],
    admin: ['sales.view', 'sales.create'],
    owner: null,
  },
  role_constraints: { seller: { 'sales.create': { max_discount: 10 } } },
  role_max_discount: { viewer: 0, seller: 10, admin: 30, owner: 100 },
  version: 'v2.9.0',
};

describe('permissionRegistryService', () => {
  let localStorageData: Record<string, string>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorageData = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
      removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
    });

    vi.resetModules();
    registryModule = await import('../permissionRegistryService');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getCachedRegistry', () => {
    it('returns null when nothing is cached', () => {
      const result = registryModule.getCachedRegistry();
      expect(result).toBeNull();
    });

    it('loads from localStorage on first call', () => {
      localStorageData['permission_registry'] = JSON.stringify(mockRegistry);

      const result = registryModule.getCachedRegistry();

      expect(result).toEqual(mockRegistry);
    });

    it('returns null when localStorage parse fails', () => {
      localStorageData['permission_registry'] = 'invalid-json{{{';

      const result = registryModule.getCachedRegistry();

      expect(result).toBeNull();
    });
  });

  describe('getStoredVersion', () => {
    it('returns null when no version stored', () => {
      expect(registryModule.getStoredVersion()).toBeNull();
    });

    it('returns stored version string', () => {
      localStorageData['permission_registry_version'] = 'v2.9.0';

      expect(registryModule.getStoredVersion()).toBe('v2.9.0');
    });
  });

  describe('getSystemRolePermissions', () => {
    it('returns empty set when no cache exists', () => {
      const perms = registryModule.getSystemRolePermissions('seller');
      expect(perms.size).toBe(0);
    });

    it('returns permission set from cached registry', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });
      await registryModule.fetchPermissionRegistry();

      const perms = registryModule.getSystemRolePermissions('seller');

      expect(perms).toEqual(new Set(['sales.view', 'sales.create']));
    });

    it('returns empty set for owner role (null means all)', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });
      await registryModule.fetchPermissionRegistry();

      const perms = registryModule.getSystemRolePermissions('owner');

      expect(perms.size).toBe(0);
    });

    it('returns empty set for unknown role', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });
      await registryModule.fetchPermissionRegistry();

      const perms = registryModule.getSystemRolePermissions('nonexistent');
      expect(perms.size).toBe(0);
    });
  });

  describe('getRoleMaxDiscount', () => {
    it('returns 0 when no cache', () => {
      expect(registryModule.getRoleMaxDiscount('seller')).toBe(0);
    });

    it('returns correct max discount from cached registry', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });
      await registryModule.fetchPermissionRegistry();

      expect(registryModule.getRoleMaxDiscount('seller')).toBe(10);
      expect(registryModule.getRoleMaxDiscount('owner')).toBe(100);
    });

    it('returns 0 for unknown role', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });
      await registryModule.fetchPermissionRegistry();

      expect(registryModule.getRoleMaxDiscount('unknown')).toBe(0);
    });
  });

  describe('isOwnerRole', () => {
    it('defaults to checking string equality when no cache', () => {
      expect(registryModule.isOwnerRole('owner')).toBe(true);
      expect(registryModule.isOwnerRole('admin')).toBe(false);
    });

    it('checks registry for null permission list', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });
      await registryModule.fetchPermissionRegistry();

      expect(registryModule.isOwnerRole('owner')).toBe(true);
      expect(registryModule.isOwnerRole('seller')).toBe(false);
    });
  });

  describe('fetchPermissionRegistry', () => {
    it('fetches from API and caches in localStorage', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });

      const result = await registryModule.fetchPermissionRegistry();

      expect(apiMock.get).toHaveBeenCalledWith('/permissions/registry');
      expect(result).toEqual(mockRegistry);
      expect(localStorage.setItem).toHaveBeenCalledWith('permission_registry', JSON.stringify(mockRegistry));
      expect(localStorage.setItem).toHaveBeenCalledWith('permission_registry_version', 'v2.9.0');
    });

    it('falls back to cached version on API error', async () => {
      localStorageData['permission_registry'] = JSON.stringify(mockRegistry);
      vi.resetModules();
      registryModule = await import('../permissionRegistryService');

      (apiMock.get as Mock).mockRejectedValueOnce(new Error('network'));

      const result = await registryModule.fetchPermissionRegistry();

      expect(result).toEqual(mockRegistry);
    });

    it('throws when API fails and no cache exists', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('network'));

      await expect(registryModule.fetchPermissionRegistry()).rejects.toThrow('No se pudo cargar el registro de permisos');
    });
  });

  describe('checkPermissionsRefresh', () => {
    it('returns response data on success', async () => {
      const refreshData = { status: 'stale' as const, permissions_version: 5 };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: refreshData });

      const result = await registryModule.checkPermissionsRefresh(3);

      expect(apiMock.get).toHaveBeenCalledWith('/auth/permissions-refresh?version=3');
      expect(result).toEqual(refreshData);
    });

    it('returns null on API error', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('fail'));

      const result = await registryModule.checkPermissionsRefresh(1);

      expect(result).toBeNull();
    });
  });

  describe('refreshRegistryIfStale', () => {
    it('updates cache when version differs', async () => {
      localStorageData['permission_registry_version'] = 'v2.8.0';
      vi.resetModules();
      registryModule = await import('../permissionRegistryService');

      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });

      await registryModule.refreshRegistryIfStale();

      expect(localStorage.setItem).toHaveBeenCalledWith('permission_registry', JSON.stringify(mockRegistry));
    });

    it('skips update when version matches', async () => {
      localStorageData['permission_registry_version'] = 'v2.9.0';
      vi.resetModules();
      registryModule = await import('../permissionRegistryService');

      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockRegistry });

      await registryModule.refreshRegistryIfStale();

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });

    it('silently fails on API error', async () => {
      (apiMock.get as Mock).mockRejectedValueOnce(new Error('fail'));

      await expect(registryModule.refreshRegistryIfStale()).resolves.toBeUndefined();
    });
  });
});
