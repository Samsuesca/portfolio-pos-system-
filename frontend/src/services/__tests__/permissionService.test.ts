import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import apiClient from '../../utils/api-client';
import { permissionService } from '../permissionService';
import type { CustomRole, SchoolUser, AvailableUser } from '../permissionService';

vi.mock('../../utils/api-client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const apiMock = vi.mocked(apiClient);

const SCHOOL_ID = 'school-1';
const ROLE_ID = 'role-1';
const USER_ID = 'user-1';

const mockCustomRole: CustomRole = {
  id: ROLE_ID,
  code: 'custom_seller',
  name: 'Vendedor Avanzado',
  description: 'Vendedor con permisos extra',
  color: '#FF0000',
  icon: 'star',
  priority: 10,
  is_system: false,
  is_active: true,
  permissions: [
    { permission_code: 'sales.view', permission_name: 'Ver Ventas', max_discount_percent: null, max_amount: null, requires_approval: false },
  ],
  user_count: 3,
};

const mockSchoolUser: SchoolUser = {
  id: USER_ID,
  username: 'vendedor1',
  email: 'vendedor@test.com',
  full_name: 'Juan Vendedor',
  is_active: true,
  is_superuser: false,
  role: 'seller',
  custom_role_id: null,
  custom_role_name: null,
  is_primary: false,
  joined_at: '2026-01-01T00:00:00',
};

describe('permissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPermissionCatalog', () => {
    const backendResponse = {
      categories: {
        sales: [
          { id: 'p1', code: 'sales.view', name: 'Ver Ventas', description: null, category: 'sales', is_sensitive: false },
          { id: 'p2', code: 'sales.create', name: 'Crear Ventas', description: null, category: 'sales', is_sensitive: false },
        ],
        inventory: [
          { id: 'p3', code: 'inventory.view', name: 'Ver Inventario', description: null, category: 'inventory', is_sensitive: false },
        ],
      },
      total: 3,
    };

    it('transforms backend categories dict into flat arrays', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: backendResponse });

      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles/permissions`);
      expect(result.permissions).toHaveLength(3);
      expect(result.categories).toHaveLength(2);
      expect(result.total).toBe(3);
    });

    it('maps category codes to Spanish names via CATEGORY_NAMES', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: backendResponse });

      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);

      const salesCategory = result.categories.find(c => c.code === 'sales');
      const inventoryCategory = result.categories.find(c => c.code === 'inventory');
      expect(salesCategory?.name).toBe('Ventas');
      expect(inventoryCategory?.name).toBe('Inventario');
    });

    it('falls back to code when category name is unknown', async () => {
      const customCategory = {
        categories: { custom_cat: [{ id: 'px', code: 'custom_cat.view', name: 'Ver', description: null, category: 'custom_cat', is_sensitive: false }] },
        total: 1,
      };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: customCategory });

      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);

      expect(result.categories[0].name).toBe('custom_cat');
    });

    it('sorts categories alphabetically by name', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: backendResponse });

      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);

      const names = result.categories.map(c => c.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('sets owner role default_permissions to all permission codes', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: backendResponse });

      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);

      const ownerRole = result.system_roles.find(r => r.role === 'owner');
      expect(ownerRole).toBeDefined();
      expect(ownerRole!.default_permissions).toEqual(
        expect.arrayContaining(['sales.view', 'sales.create', 'inventory.view'])
      );
      expect(ownerRole!.default_permissions).toHaveLength(3);
    });

    it('includes all four system roles', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: backendResponse });

      const result = await permissionService.getPermissionCatalog(SCHOOL_ID);

      const roles = result.system_roles.map(r => r.role);
      expect(roles).toEqual(['viewer', 'seller', 'admin', 'owner']);
    });
  });

  describe('getRoles', () => {
    it('fetches roles and returns the roles array', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { roles: [mockCustomRole], total: 1 } });

      const result = await permissionService.getRoles(SCHOOL_ID);

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles`, { params: undefined });
      expect(result).toEqual([mockCustomRole]);
    });

    it('passes filter params to the API', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { roles: [], total: 0 } });

      await permissionService.getRoles(SCHOOL_ID, { include_system: true, active_only: true });

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles`, {
        params: { include_system: true, active_only: true },
      });
    });
  });

  describe('getRole', () => {
    it('fetches a single role by id', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockCustomRole });

      const result = await permissionService.getRole(SCHOOL_ID, ROLE_ID);

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles/${ROLE_ID}`);
      expect(result).toEqual(mockCustomRole);
    });
  });

  describe('createRole', () => {
    it('converts string permissions to objects for backend', async () => {
      const input = { code: 'new_role', name: 'Nuevo Rol', permissions: ['sales.view', 'inventory.view'] };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockCustomRole });

      await permissionService.createRole(SCHOOL_ID, input);

      expect(apiMock.post).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles`, {
        code: 'new_role',
        name: 'Nuevo Rol',
        permissions: [{ code: 'sales.view' }, { code: 'inventory.view' }],
      });
    });

    it('passes PermissionWithConstraints objects as-is', async () => {
      const perms = [{ code: 'sales.create', max_discount_percent: 15, requires_approval: true }];
      const input = { code: 'constrained', name: 'Restringido', permissions: perms };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockCustomRole });

      await permissionService.createRole(SCHOOL_ID, input);

      expect(apiMock.post).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles`, {
        code: 'constrained',
        name: 'Restringido',
        permissions: perms,
      });
    });

    it('sends empty permissions array when none provided', async () => {
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockCustomRole });

      await permissionService.createRole(SCHOOL_ID, { code: 'empty', name: 'Vacio' });

      expect(apiMock.post).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles`, {
        code: 'empty',
        name: 'Vacio',
        permissions: [],
      });
    });
  });

  describe('updateRole', () => {
    it('converts string permissions and uses PUT', async () => {
      const update = { name: 'Actualizado', permissions: ['sales.view'] };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockCustomRole, name: 'Actualizado' } });

      const result = await permissionService.updateRole(SCHOOL_ID, ROLE_ID, update);

      expect(apiMock.put).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles/${ROLE_ID}`, {
        name: 'Actualizado',
        permissions: [{ code: 'sales.view' }],
      });
      expect(result.name).toBe('Actualizado');
    });

    it('sends undefined permissions when not provided in update', async () => {
      const update = { name: 'Solo nombre' };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockCustomRole, name: 'Solo nombre' } });

      await permissionService.updateRole(SCHOOL_ID, ROLE_ID, update);

      expect(apiMock.put).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles/${ROLE_ID}`, {
        name: 'Solo nombre',
        permissions: undefined,
      });
    });
  });

  describe('deleteRole', () => {
    it('deletes a custom role', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({});

      await permissionService.deleteRole(SCHOOL_ID, ROLE_ID);

      expect(apiMock.delete).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/roles/${ROLE_ID}`);
    });
  });

  describe('getGlobalCustomRoles', () => {
    it('fetches global roles', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [mockCustomRole] });

      const result = await permissionService.getGlobalCustomRoles();

      expect(apiMock.get).toHaveBeenCalledWith('/global/roles', { params: undefined });
      expect(result).toEqual([mockCustomRole]);
    });

    it('passes active_only param', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: [] });

      await permissionService.getGlobalCustomRoles({ active_only: true });

      expect(apiMock.get).toHaveBeenCalledWith('/global/roles', { params: { active_only: true } });
    });
  });

  describe('createGlobalRole', () => {
    it('converts string permissions for global role creation', async () => {
      const input = { code: 'global_role', name: 'Rol Global', permissions: ['sales.view'] };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: mockCustomRole });

      await permissionService.createGlobalRole(input);

      expect(apiMock.post).toHaveBeenCalledWith('/global/roles', {
        code: 'global_role',
        name: 'Rol Global',
        permissions: [{ code: 'sales.view' }],
      });
    });
  });

  describe('updateGlobalRole', () => {
    it('converts string permissions and uses PUT on global endpoint', async () => {
      const update = { permissions: ['inventory.view'] };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: mockCustomRole });

      await permissionService.updateGlobalRole(ROLE_ID, update);

      expect(apiMock.put).toHaveBeenCalledWith(`/global/roles/${ROLE_ID}`, {
        permissions: [{ code: 'inventory.view' }],
      });
    });
  });

  describe('deleteGlobalRole', () => {
    it('deletes a global role', async () => {
      (apiMock.delete as Mock).mockResolvedValueOnce({});

      await permissionService.deleteGlobalRole(ROLE_ID);

      expect(apiMock.delete).toHaveBeenCalledWith(`/global/roles/${ROLE_ID}`);
    });
  });

  describe('getSchoolUsers', () => {
    it('fetches users for a school', async () => {
      const listResponse = { items: [mockSchoolUser], total: 1, skip: 0, limit: 20, page: 1, total_pages: 1, has_more: false };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: listResponse });

      const result = await permissionService.getSchoolUsers(SCHOOL_ID);

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users`, { params: undefined });
      expect(result.items).toEqual([mockSchoolUser]);
    });

    it('passes search and role filter params', async () => {
      const params = { search: 'juan', role_filter: 'seller' as const };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { items: [], total: 0, skip: 0, limit: 20, page: 1, total_pages: 0, has_more: false } });

      await permissionService.getSchoolUsers(SCHOOL_ID, params);

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users`, { params });
    });
  });

  describe('getSchoolUser', () => {
    it('fetches a single user in a school', async () => {
      (apiMock.get as Mock).mockResolvedValueOnce({ data: mockSchoolUser });

      const result = await permissionService.getSchoolUser(SCHOOL_ID, USER_ID);

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users/${USER_ID}`);
      expect(result).toEqual(mockSchoolUser);
    });
  });

  describe('getAvailableUsers', () => {
    it('fetches users not yet in the school', async () => {
      const available: AvailableUser = { id: 'u-2', username: 'nuevo', email: 'nuevo@test.com', full_name: 'Nuevo User', is_active: true, is_superuser: false };
      (apiMock.get as Mock).mockResolvedValueOnce({ data: { users: [available], total: 1 } });

      const result = await permissionService.getAvailableUsers(SCHOOL_ID, { search: 'nuevo' });

      expect(apiMock.get).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users/available`, { params: { search: 'nuevo' } });
      expect(result.users).toHaveLength(1);
    });
  });

  describe('inviteUser', () => {
    it('invites a user to a school', async () => {
      const invite = { email: 'new@test.com', role: 'seller' as const };
      const responseData = { user_id: 'u-3', email: 'new@test.com', role: 'seller', custom_role_id: null, message: 'Invitado' };
      (apiMock.post as Mock).mockResolvedValueOnce({ data: responseData });

      const result = await permissionService.inviteUser(SCHOOL_ID, invite);

      expect(apiMock.post).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users/invite`, invite);
      expect(result.user_id).toBe('u-3');
    });
  });

  describe('updateUserRole', () => {
    it('updates a user role via PUT', async () => {
      const update = { role: 'admin' as const };
      (apiMock.put as Mock).mockResolvedValueOnce({ data: { ...mockSchoolUser, role: 'admin' } });

      const result = await permissionService.updateUserRole(SCHOOL_ID, USER_ID, update);

      expect(apiMock.put).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users/${USER_ID}/role`, update);
      expect(result.role).toBe('admin');
    });
  });

  describe('removeUser', () => {
    it('removes a user from a school', async () => {
      const responseData = { user_id: USER_ID, message: 'Eliminado' };
      (apiMock.delete as Mock).mockResolvedValueOnce({ data: responseData });

      const result = await permissionService.removeUser(SCHOOL_ID, USER_ID);

      expect(apiMock.delete).toHaveBeenCalledWith(`/schools/${SCHOOL_ID}/users/${USER_ID}`);
      expect(result.message).toBe('Eliminado');
    });
  });
});
