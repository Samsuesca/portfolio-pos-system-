import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

import apiClient from '../utils/api-client';
import { permissionService } from './permissionService';

const api = vi.mocked(apiClient);
const SCHOOL_ID = 'school-uuid-1';
const ROLE_ID = 'role-uuid-1';
const USER_ID = 'user-uuid-1';

const mockRole = {
  id: ROLE_ID, code: 'custom_role', name: 'Custom Role',
  description: null, color: null, icon: null,
  priority: 1, is_system: false, is_active: true,
  permissions: [], user_count: 0,
};

const mockUser = {
  id: USER_ID, username: 'jdoe', email: 'jdoe@test.com',
  full_name: 'John Doe', is_active: true, is_superuser: false,
  role: 'seller', custom_role_id: null, custom_role_name: null,
  is_primary: false, joined_at: '2024-01-01T00:00:00Z',
};

describe('permissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getPermissionCatalog ──────────────────────────────────────────────────

  describe('getPermissionCatalog', () => {
    it('transforms backend category dict to arrays', async () => {
      const backendResponse = {
        categories: {
          sales: [{ id: 'p1', code: 'sales.create', name: 'Create Sales', description: null, category: 'sales', is_sensitive: false }],
          products: [{ id: 'p2', code: 'products.view', name: 'View Products', description: null, category: 'products', is_sensitive: false }],
        },
        total: 2,
      };
      api.get.mockResolvedValueOnce({ data: backendResponse, status: 200 });

      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);

      expect(result.permissions).toHaveLength(2);
      expect(result.categories.some(c => c.code === 'sales')).toBe(true);
      expect(result.categories.some(c => c.code === 'products')).toBe(true);
      expect(result.total).toBe(2);
    });

    it('maps category codes to Spanish names', async () => {
      api.get.mockResolvedValueOnce({
        data: { categories: { accounting: [] }, total: 0 },
        status: 200,
      });
      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);
      const accountingCat = result.categories.find(c => c.code === 'accounting');
      expect(accountingCat?.name).toBe('Contabilidad');
    });

    it('includes system roles in the result', async () => {
      api.get.mockResolvedValueOnce({
        data: { categories: {}, total: 0 },
        status: 200,
      });
      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);
      expect(result.system_roles.length).toBeGreaterThan(0);
      const roles = result.system_roles.map(r => r.role);
      expect(roles).toContain('owner');
      expect(roles).toContain('seller');
    });
  });

  // ─── getRoles ─────────────────────────────────────────────────────────────

  describe('getRoles', () => {
    it('returns roles array from response', async () => {
      api.get.mockResolvedValueOnce({ data: { roles: [mockRole], total: 1 }, status: 200 });
      const result = await permissionService.getRoles(SCHOOL_ID);
      expect(result).toEqual([mockRole]);
      expect(api.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles`, { params: undefined });
    });

    it('passes params to the API call', async () => {
      api.get.mockResolvedValueOnce({ data: { roles: [], total: 0 }, status: 200 });
      await permissionService.getRoles(SCHOOL_ID, { include_system: true });
      expect(api.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles`, { params: { include_system: true } });
    });
  });

  // ─── getRole ──────────────────────────────────────────────────────────────

  describe('getRole', () => {
    it('returns single role', async () => {
      api.get.mockResolvedValueOnce({ data: mockRole, status: 200 });
      const result = await permissionService.getRole(SCHOOL_ID, ROLE_ID);
      expect(result).toEqual(mockRole);
      expect(api.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles/${ROLE_ID}`);
    });
  });

  // ─── createRole ───────────────────────────────────────────────────────────

  describe('createRole', () => {
    it('creates role and returns it', async () => {
      api.post.mockResolvedValueOnce({ data: mockRole, status: 201 });
      const result = await permissionService.createRole(SCHOOL_ID, { code: 'custom', name: 'Custom' });
      expect(result).toEqual(mockRole);
    });

    it('converts string permissions to {code} objects', async () => {
      api.post.mockResolvedValueOnce({ data: mockRole, status: 201 });
      await permissionService.createRole(SCHOOL_ID, { code: 'custom', name: 'Custom', permissions: ['sales.create', 'products.view'] });
      const body = api.post.mock.calls[0][1] as any;
      expect(body.permissions).toEqual([{ code: 'sales.create' }, { code: 'products.view' }]);
    });

    it('passes PermissionWithConstraints objects through unchanged', async () => {
      api.post.mockResolvedValueOnce({ data: mockRole, status: 201 });
      const perm = { code: 'sales.apply_discount', max_discount_percent: 15 };
      await permissionService.createRole(SCHOOL_ID, { code: 'custom', name: 'Custom', permissions: [perm] });
      const body = api.post.mock.calls[0][1] as any;
      expect(body.permissions[0]).toEqual(perm);
    });
  });

  // ─── updateRole ───────────────────────────────────────────────────────────

  describe('updateRole', () => {
    it('updates role and returns updated version', async () => {
      const updated = { ...mockRole, name: 'Updated Name' };
      api.put.mockResolvedValueOnce({ data: updated, status: 200 });
      const result = await permissionService.updateRole(SCHOOL_ID, ROLE_ID, { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('converts string permissions to {code} objects', async () => {
      api.put.mockResolvedValueOnce({ data: mockRole, status: 200 });
      await permissionService.updateRole(SCHOOL_ID, ROLE_ID, { permissions: ['sales.cancel'] });
      const body = api.put.mock.calls[0][1] as any;
      expect(body.permissions).toEqual([{ code: 'sales.cancel' }]);
    });
  });

  // ─── deleteRole ───────────────────────────────────────────────────────────

  describe('deleteRole', () => {
    it('calls delete endpoint and returns void', async () => {
      api.delete.mockResolvedValueOnce({ data: {}, status: 204 });
      await expect(permissionService.deleteRole(SCHOOL_ID, ROLE_ID)).resolves.toBeUndefined();
      expect(api.delete).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles/${ROLE_ID}`);
    });
  });

  // ─── getGlobalCustomRoles ─────────────────────────────────────────────────

  describe('getGlobalCustomRoles', () => {
    it('returns global roles array', async () => {
      api.get.mockResolvedValueOnce({ data: [mockRole], status: 200 });
      const result = await permissionService.getGlobalCustomRoles();
      expect(result).toEqual([mockRole]);
    });
  });

  // ─── createGlobalRole ─────────────────────────────────────────────────────

  describe('createGlobalRole', () => {
    it('creates global role', async () => {
      api.post.mockResolvedValueOnce({ data: mockRole, status: 201 });
      const result = await permissionService.createGlobalRole({ code: 'global', name: 'Global Role' });
      expect(result).toEqual(mockRole);
      expect(api.post).toHaveBeenCalledWith('/global/roles', expect.any(Object));
    });
  });

  // ─── updateGlobalRole ─────────────────────────────────────────────────────

  describe('updateGlobalRole', () => {
    it('updates global role', async () => {
      api.put.mockResolvedValueOnce({ data: mockRole, status: 200 });
      const result = await permissionService.updateGlobalRole(ROLE_ID, { name: 'Updated' });
      expect(result).toEqual(mockRole);
    });
  });

  // ─── deleteGlobalRole ─────────────────────────────────────────────────────

  describe('deleteGlobalRole', () => {
    it('calls delete for global role', async () => {
      api.delete.mockResolvedValueOnce({ data: {}, status: 204 });
      await permissionService.deleteGlobalRole(ROLE_ID);
      expect(api.delete).toHaveBeenCalledWith(`/global/roles/${ROLE_ID}`);
    });
  });

  // ─── getSchoolUsers ───────────────────────────────────────────────────────

  describe('getSchoolUsers', () => {
    it('returns school user list', async () => {
      const userList = { items: [mockUser], total: 1, skip: 0, limit: 20, page: 1, total_pages: 1, has_more: false };
      api.get.mockResolvedValueOnce({ data: userList, status: 200 });
      const result = await permissionService.getSchoolUsers(SCHOOL_ID);
      expect(result.items).toHaveLength(1);
    });

    it('passes search params', async () => {
      const userList = { items: [], total: 0, skip: 0, limit: 20, page: 1, total_pages: 1, has_more: false };
      api.get.mockResolvedValueOnce({ data: userList, status: 200 });
      await permissionService.getSchoolUsers(SCHOOL_ID, { search: 'john', limit: 5 });
      expect(api.get).toHaveBeenCalledWith(
        `/schools/${SCHOOL_ID}/users`,
        { params: { search: 'john', limit: 5 } }
      );
    });
  });

  // ─── inviteUser ───────────────────────────────────────────────────────────

  describe('inviteUser', () => {
    it('invites user and returns response', async () => {
      const inviteResponse = { user_id: USER_ID, email: 'x@x.com', role: 'seller', custom_role_id: null, message: 'Invited' };
      api.post.mockResolvedValueOnce({ data: inviteResponse, status: 200 });
      const result = await permissionService.inviteUser(SCHOOL_ID, { email: 'x@x.com', role: 'seller' });
      expect(result.message).toBe('Invited');
    });
  });

  // ─── updateUserRole ───────────────────────────────────────────────────────

  describe('updateUserRole', () => {
    it('updates user role', async () => {
      api.put.mockResolvedValueOnce({ data: mockUser, status: 200 });
      const result = await permissionService.updateUserRole(SCHOOL_ID, USER_ID, { role: 'admin' });
      expect(result).toEqual(mockUser);
    });
  });

  // ─── removeUser ───────────────────────────────────────────────────────────

  describe('removeUser', () => {
    it('removes user and returns confirmation', async () => {
      const response = { user_id: USER_ID, message: 'Removed' };
      api.delete.mockResolvedValueOnce({ data: response, status: 200 });
      const result = await permissionService.removeUser(SCHOOL_ID, USER_ID);
      expect(result.user_id).toBe(USER_ID);
    });
  });

  // ─── getSchoolUser ─────────────────────────────────────────────────────────

  describe('getSchoolUser', () => {
    it('returns a single school user', async () => {
      api.get.mockResolvedValueOnce({ data: mockUser, status: 200 });
      const result = await permissionService.getSchoolUser(SCHOOL_ID, USER_ID);
      expect(result).toEqual(mockUser);
      expect(api.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users/${USER_ID}`);
    });
  });

  // ─── getAvailableUsers ────────────────────────────────────────────────────

  describe('getAvailableUsers', () => {
    it('returns available users list', async () => {
      const response = { users: [mockUser], total: 1 };
      api.get.mockResolvedValueOnce({ data: response, status: 200 });
      const result = await permissionService.getAvailableUsers(SCHOOL_ID);
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('passes search params', async () => {
      api.get.mockResolvedValueOnce({ data: { users: [], total: 0 }, status: 200 });
      await permissionService.getAvailableUsers(SCHOOL_ID, { search: 'john', limit: 5 });
      expect(api.get).toHaveBeenCalledWith(
        `/schools/${SCHOOL_ID}/users/available`,
        { params: { search: 'john', limit: 5 } }
      );
    });
  });

  // ─── error propagation ────────────────────────────────────────────────────

  describe('error propagation', () => {
    it('lets API errors bubble up from getRoles', async () => {
      api.get.mockRejectedValueOnce(new Error('Network error'));
      await expect(permissionService.getRoles(SCHOOL_ID)).rejects.toThrow('Network error');
    });

    it('lets API errors bubble up from createRole', async () => {
      api.post.mockRejectedValueOnce(new Error('Validation error'));
      await expect(
        permissionService.createRole(SCHOOL_ID, { code: 'x', name: 'X' })
      ).rejects.toThrow('Validation error');
    });
  });
});
