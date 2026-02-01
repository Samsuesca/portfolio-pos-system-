/**
 * UserManagement - Shared types for user management components
 */
import type { UserRole } from '../../types/api';
import type { School } from '../../services/schoolService';
import type {
  SchoolUser,
  CustomRole,
  PermissionCatalog,
  InviteUserRequest,
  UpdateUserRoleRequest,
  CreateRoleRequest,
  AvailableUser,
} from '../../services/permissionService';
import type { UserCreate, UserSchoolRole } from '../../services/userService';

// Re-export for convenience
export type {
  UserRole,
  School,
  SchoolUser,
  CustomRole,
  PermissionCatalog,
  InviteUserRequest,
  UpdateUserRoleRequest,
  CreateRoleRequest,
  AvailableUser,
  UserCreate,
  UserSchoolRole,
};

// System roles display info
export interface SystemRoleDisplay {
  role: UserRole;
  permissions: number;
  description: string;
}

export const SYSTEM_ROLES: SystemRoleDisplay[] = [
  { role: 'viewer', permissions: 8, description: 'Solo puede ver informacion' },
  { role: 'seller', permissions: 26, description: 'Puede crear ventas y pedidos' },
  { role: 'admin', permissions: 46, description: 'Gestion completa excepto usuarios' },
  { role: 'owner', permissions: 65, description: 'Acceso total al colegio' },
];

// Tab types
export type TabType = 'users' | 'roles';

// Message state
export interface MessageState {
  error: string | null;
  success: string | null;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
}

// User Management Context - shared state across components
export interface UserManagementContextValue {
  // Schools
  schools: School[];
  schoolsLoading: boolean;
  selectedSchoolId: string;
  setSelectedSchoolId: (id: string) => void;
  selectedSchool: School | undefined;

  // Users
  schoolUsers: SchoolUser[];
  usersLoading: boolean;
  userSearchTerm: string;
  setUserSearchTerm: (term: string) => void;
  userRoleFilter: UserRole | '';
  setUserRoleFilter: (filter: UserRole | '') => void;
  loadSchoolUsers: () => Promise<void>;

  // Roles
  customRoles: CustomRole[];
  rolesLoading: boolean;
  permissionCatalog: PermissionCatalog | null;
  globalCustomRoles: CustomRole[];
  loadRolesAndPermissions: () => Promise<void>;

  // General state
  saving: boolean;
  setSaving: (saving: boolean) => void;
  messages: MessageState;

  // Current user
  currentUser: {
    id: string;
    is_superuser: boolean;
  } | null;
}
