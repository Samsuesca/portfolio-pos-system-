/**
 * Permission Service - API calls for permission and role management
 */
import apiClient from '../utils/api-client';
import type { UserRole } from '../types/api';

// ============================================
// Types
// ============================================

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  is_sensitive: boolean;
}

export interface PermissionCategory {
  code: string;
  name: string;
  description: string | null;
}

export interface SystemRoleInfo {
  role: UserRole;
  name: string;
  description: string;
  default_permissions: string[];
}

// Backend response type (categories is a dict)
interface PermissionCatalogBackend {
  categories: Record<string, Permission[]>;
  total: number;
}

// Frontend type (transformed for easier use)
export interface PermissionCatalog {
  permissions: Permission[];
  categories: PermissionCategory[];
  system_roles: SystemRoleInfo[];
  total: number;
}

// Category name mappings
const CATEGORY_NAMES: Record<string, string> = {
  sales: 'Ventas',
  products: 'Productos',
  inventory: 'Inventario',
  clients: 'Clientes',
  orders: 'Pedidos',
  accounting: 'Contabilidad',
  reports: 'Reportes',
  users: 'Usuarios',
  school: 'Colegio',
  changes: 'Cambios',
  alterations: 'Alteraciones',
  global: 'Global',
};

// Default permissions for system roles
const SYSTEM_ROLE_DEFAULTS: SystemRoleInfo[] = [
  {
    role: 'viewer',
    name: 'Visualizador',
    description: 'Solo puede ver información',
    default_permissions: ['sales.view', 'products.view', 'clients.view', 'orders.view', 'inventory.view'],
  },
  {
    role: 'seller',
    name: 'Vendedor',
    description: 'Puede crear ventas y pedidos',
    default_permissions: ['sales.view', 'sales.create', 'sales.add_payment', 'products.view', 'clients.view', 'clients.create', 'orders.view', 'orders.create', 'inventory.view'],
  },
  {
    role: 'admin',
    name: 'Administrador',
    description: 'Gestión completa excepto usuarios',
    default_permissions: ['sales.view', 'sales.create', 'sales.edit', 'sales.cancel', 'sales.apply_discount', 'products.view', 'products.create', 'products.edit', 'products.delete', 'clients.view', 'clients.create', 'clients.edit', 'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'inventory.view', 'inventory.adjust', 'accounting.view', 'reports.view'],
  },
  {
    role: 'owner',
    name: 'Propietario',
    description: 'Acceso total al colegio',
    default_permissions: [], // All permissions
  },
];

export interface RolePermission {
  permission_code: string;
  permission_name: string;
  max_discount_percent: number | null;
  max_amount: number | null;
  requires_approval: boolean;
}

export interface CustomRole {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  priority: number;
  is_system: boolean;
  is_active: boolean;
  permissions: RolePermission[];
  user_count: number;
}

export interface CustomRoleList {
  roles: CustomRole[];
  total: number;
}

export interface CreateRoleRequest {
  code: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  priority?: number;
  permissions?: string[] | PermissionWithConstraints[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  priority?: number;
  is_active?: boolean;
  permissions?: string[] | PermissionWithConstraints[];
}

export interface PermissionWithConstraints {
  code: string;
  max_discount_percent?: number;
  max_amount?: number;
  requires_approval?: boolean;
}

// School Users Types
export interface SchoolUser {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  role: UserRole | null;
  custom_role_id: string | null;
  custom_role_name: string | null;
  is_primary: boolean;
  joined_at: string;
}

export interface SchoolUserList {
  users: SchoolUser[];
  total: number;
}

export interface AvailableUser {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
}

export interface InviteUserRequest {
  email: string;
  role?: UserRole;
  custom_role_id?: string;
  is_primary?: boolean;
}

export interface InviteUserResponse {
  user_id: string;
  email: string;
  role: UserRole | null;
  custom_role_id: string | null;
  message: string;
}

export interface UpdateUserRoleRequest {
  role?: UserRole;
  custom_role_id?: string;
  is_primary?: boolean;
}

// ============================================
// Service
// ============================================

export const permissionService = {
  // ==========================================
  // Custom Roles
  // ==========================================

  /**
   * Get permission catalog (all available permissions)
   * Transforms backend response to frontend format
   */
  async getPermissionCatalog(schoolId: string): Promise<PermissionCatalog> {
    const response = await apiClient.get<PermissionCatalogBackend>(
      `/schools/${schoolId}/roles/permissions`
    );

    const backendData = response.data;

    // Transform categories dict to arrays
    const permissions: Permission[] = [];
    const categories: PermissionCategory[] = [];

    for (const [code, perms] of Object.entries(backendData.categories)) {
      // Add category
      categories.push({
        code,
        name: CATEGORY_NAMES[code] || code,
        description: null,
      });

      // Add permissions
      permissions.push(...perms);
    }

    // Sort categories alphabetically by name
    categories.sort((a, b) => a.name.localeCompare(b.name));

    // Set owner default permissions to all permissions
    const ownerRole = SYSTEM_ROLE_DEFAULTS.find(r => r.role === 'owner');
    if (ownerRole && ownerRole.default_permissions.length === 0) {
      ownerRole.default_permissions = permissions.map(p => p.code);
    }

    return {
      permissions,
      categories,
      system_roles: SYSTEM_ROLE_DEFAULTS,
      total: backendData.total,
    };
  },

  /**
   * List all roles for a school (system + custom)
   */
  async getRoles(
    schoolId: string,
    params?: { include_system?: boolean; active_only?: boolean }
  ): Promise<CustomRole[]> {
    const response = await apiClient.get<CustomRoleList>(
      `/schools/${schoolId}/roles`,
      { params }
    );
    return response.data.roles;
  },

  /**
   * Get a specific role
   */
  async getRole(schoolId: string, roleId: string): Promise<CustomRole> {
    const response = await apiClient.get<CustomRole>(
      `/schools/${schoolId}/roles/${roleId}`
    );
    return response.data;
  },

  /**
   * Create a custom role
   * Converts string[] permissions to PermissionWithConstraints[] for backend
   */
  async createRole(schoolId: string, data: CreateRoleRequest): Promise<CustomRole> {
    // Convert permissions array to backend format if needed
    const requestData = {
      ...data,
      permissions: data.permissions
        ? data.permissions.map(p =>
            typeof p === 'string' ? { code: p } : p
          )
        : [],
    };

    const response = await apiClient.post<CustomRole>(
      `/schools/${schoolId}/roles`,
      requestData
    );
    return response.data;
  },

  /**
   * Update a custom role
   * Converts string[] permissions to PermissionWithConstraints[] for backend
   */
  async updateRole(
    schoolId: string,
    roleId: string,
    data: UpdateRoleRequest
  ): Promise<CustomRole> {
    // Convert permissions array to backend format if needed
    const requestData = {
      ...data,
      permissions: data.permissions
        ? data.permissions.map(p =>
            typeof p === 'string' ? { code: p } : p
          )
        : undefined,
    };

    const response = await apiClient.put<CustomRole>(
      `/schools/${schoolId}/roles/${roleId}`,
      requestData
    );
    return response.data;
  },

  /**
   * Delete a custom role
   */
  async deleteRole(schoolId: string, roleId: string): Promise<void> {
    await apiClient.delete(`/schools/${schoolId}/roles/${roleId}`);
  },

  // ==========================================
  // Global Custom Roles (transversal to all schools)
  // ==========================================

  /**
   * List all global custom roles
   * These roles can be assigned to users in any school
   */
  async getGlobalCustomRoles(params?: { active_only?: boolean }): Promise<CustomRole[]> {
    const response = await apiClient.get<CustomRole[]>(
      '/global/roles',
      { params }
    );
    return response.data;
  },

  /**
   * Create a global custom role (superuser only)
   */
  async createGlobalRole(data: CreateRoleRequest): Promise<CustomRole> {
    const requestData = {
      ...data,
      permissions: data.permissions
        ? data.permissions.map(p =>
            typeof p === 'string' ? { code: p } : p
          )
        : [],
    };

    const response = await apiClient.post<CustomRole>(
      '/global/roles',
      requestData
    );
    return response.data;
  },

  /**
   * Update a global custom role (superuser only)
   */
  async updateGlobalRole(roleId: string, data: UpdateRoleRequest): Promise<CustomRole> {
    const requestData = {
      ...data,
      permissions: data.permissions
        ? data.permissions.map(p =>
            typeof p === 'string' ? { code: p } : p
          )
        : undefined,
    };

    const response = await apiClient.put<CustomRole>(
      `/global/roles/${roleId}`,
      requestData
    );
    return response.data;
  },

  /**
   * Delete a global custom role (superuser only)
   */
  async deleteGlobalRole(roleId: string): Promise<void> {
    await apiClient.delete(`/global/roles/${roleId}`);
  },

  // ==========================================
  // School Users (OWNER self-management)
  // ==========================================

  /**
   * List users in a school
   */
  async getSchoolUsers(
    schoolId: string,
    params?: {
      skip?: number;
      limit?: number;
      search?: string;
      role_filter?: UserRole;
    }
  ): Promise<SchoolUserList> {
    const response = await apiClient.get<SchoolUserList>(
      `/schools/${schoolId}/users`,
      { params }
    );
    return response.data;
  },

  /**
   * Get a specific user in a school
   */
  async getSchoolUser(schoolId: string, userId: string): Promise<SchoolUser> {
    const response = await apiClient.get<SchoolUser>(
      `/schools/${schoolId}/users/${userId}`
    );
    return response.data;
  },

  /**
   * Get users available to add to a school (not already members)
   */
  async getAvailableUsers(
    schoolId: string,
    params?: { search?: string; limit?: number }
  ): Promise<{ users: AvailableUser[]; total: number }> {
    const response = await apiClient.get<{ users: AvailableUser[]; total: number }>(
      `/schools/${schoolId}/users/available`,
      { params }
    );
    return response.data;
  },

  /**
   * Invite/add a user to a school
   */
  async inviteUser(
    schoolId: string,
    data: InviteUserRequest
  ): Promise<InviteUserResponse> {
    const response = await apiClient.post<InviteUserResponse>(
      `/schools/${schoolId}/users/invite`,
      data
    );
    return response.data;
  },

  /**
   * Update a user's role in a school
   */
  async updateUserRole(
    schoolId: string,
    userId: string,
    data: UpdateUserRoleRequest
  ): Promise<SchoolUser> {
    const response = await apiClient.put<SchoolUser>(
      `/schools/${schoolId}/users/${userId}/role`,
      data
    );
    return response.data;
  },

  /**
   * Remove a user from a school
   */
  async removeUser(
    schoolId: string,
    userId: string
  ): Promise<{ user_id: string; message: string }> {
    const response = await apiClient.delete<{ user_id: string; message: string }>(
      `/schools/${schoolId}/users/${userId}`
    );
    return response.data;
  },
};

export default permissionService;
