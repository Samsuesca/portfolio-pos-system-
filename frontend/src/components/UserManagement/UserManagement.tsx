/**
 * UserManagement - Users tab main component
 */
import { useState, useEffect } from 'react';
import { Building2, Search, Filter, Plus, UserPlus, Users, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { type School } from '../../services/schoolService';
import { userService, type UserCreate, type UserSchoolRole } from '../../services/userService';
import {
  permissionService,
  type SchoolUser,
  type InviteUserRequest,
  type UpdateUserRoleRequest,
  type CustomRole,
  type AvailableUser,
} from '../../services/permissionService';

import SchoolSelector from './SchoolSelector';
import UserList from './UserList';
import CreateUserModal from './modals/CreateUserModal';
import InviteUserModal from './modals/InviteUserModal';
import EditRoleModal from './modals/EditRoleModal';
import UserDetailModal from './modals/UserDetailModal';
import RemoveUserModal from './modals/RemoveUserModal';
import type { UserRole } from './types';

interface UserManagementProps {
  schools: School[];
  schoolsLoading: boolean;
  selectedSchoolId: string;
  setSelectedSchoolId: (id: string) => void;
  customRoles: CustomRole[];
  globalCustomRoles: CustomRole[];
  saving: boolean;
  setSaving: (saving: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;
}

export default function UserManagement({
  schools,
  schoolsLoading,
  selectedSchoolId,
  setSelectedSchoolId,
  customRoles,
  globalCustomRoles,
  saving,
  setSaving,
  error,
  setError,
  success: _success,
  setSuccess,
}: UserManagementProps) {
  const { user } = useAuthStore();

  // Users state
  const [schoolUsers, setSchoolUsers] = useState<SchoolUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRole | ''>('');
  const [selectedSchoolUser, setSelectedSchoolUser] = useState<SchoolUser | null>(null);

  // User modals state
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showInviteUserModal, setShowInviteUserModal] = useState(false);
  const [showEditRoleModal, setShowEditRoleModal] = useState(false);
  const [showRemoveUserModal, setShowRemoveUserModal] = useState(false);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);

  // User detail state (for multi-school role management)
  const [userSchoolRoles, setUserSchoolRoles] = useState<UserSchoolRole[]>([]);
  const [userRolesLoading, setUserRolesLoading] = useState(false);

  // User form state
  const [userForm, setUserForm] = useState<UserCreate>({
    username: '',
    email: '',
    password: '',
    full_name: '',
    is_superuser: false,
  });
  const [inviteForm, setInviteForm] = useState<InviteUserRequest>({
    email: '',
    role: 'seller',
    is_primary: false,
  });

  // State for user selection dropdown in invite modal
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [availableUsersLoading, setAvailableUsersLoading] = useState(false);
  const [selectedUserForInvite, setSelectedUserForInvite] = useState<AvailableUser | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [editRoleForm, setEditRoleForm] = useState<UpdateUserRoleRequest>({
    role: 'seller',
  });

  // Admin edit user state
  const [adminEditEmail, setAdminEditEmail] = useState('');
  const [adminEditPassword, setAdminEditPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminEmailSaving, setAdminEmailSaving] = useState(false);
  const [adminPasswordSaving, setAdminPasswordSaving] = useState(false);
  const [superuserSaving, setSuperuserSaving] = useState(false);

  // Delete user state
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  // Load users when school changes
  useEffect(() => {
    if (selectedSchoolId) {
      loadSchoolUsers();
    }
  }, [selectedSchoolId, userSearchTerm, userRoleFilter]);

  const isAllUsersMode = selectedSchoolId === '__all__';

  const loadSchoolUsers = async () => {
    if (!selectedSchoolId) return;
    setUsersLoading(true);
    setError(null);
    try {
      if (isAllUsersMode) {
        // Load all users from the system (max 100 per request)
        const allUsers = await userService.getUsers(0, 100);
        // Convert User[] to SchoolUser[] format
        const mappedUsers: SchoolUser[] = allUsers
          .filter((u) => {
            if (!userSearchTerm) return true;
            const search = userSearchTerm.toLowerCase();
            return (
              u.username.toLowerCase().includes(search) ||
              u.email.toLowerCase().includes(search) ||
              (u.full_name?.toLowerCase().includes(search) ?? false)
            );
          })
          .map((u) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            full_name: u.full_name,
            is_active: u.is_active,
            is_superuser: u.is_superuser,
            role: null,
            custom_role_id: null,
            custom_role_name: null,
            is_primary: false,
            joined_at: u.created_at,
          }));
        setSchoolUsers(mappedUsers);
      } else {
        const result = await permissionService.getSchoolUsers(selectedSchoolId, {
          search: userSearchTerm || undefined,
          role_filter: userRoleFilter || undefined,
        });
        setSchoolUsers(result.users);
      }
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError('Error al cargar usuarios');
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAvailableUsers = async (search?: string) => {
    if (!selectedSchoolId) return;
    setAvailableUsersLoading(true);
    try {
      const result = await permissionService.getAvailableUsers(selectedSchoolId, {
        search: search && search.length >= 2 ? search : undefined,
        limit: 20,
      });
      setAvailableUsers(result.users);
    } catch (err: any) {
      console.error('Error loading available users:', err);
      setAvailableUsers([]);
    } finally {
      setAvailableUsersLoading(false);
    }
  };

  // Load user's roles across all schools
  const loadUserSchoolRoles = async (userId: string) => {
    setUserRolesLoading(true);
    setError(null);
    try {
      const roles = await userService.getUserSchools(userId);
      setUserSchoolRoles(roles);
    } catch (err: any) {
      console.error('Error loading user school roles:', err);
      const errorMessage =
        err.message || err.response?.data?.detail || 'Error al cargar los roles del usuario';
      setError(errorMessage);
      setUserSchoolRoles([]);
    } finally {
      setUserRolesLoading(false);
    }
  };

  // User handlers
  const handleCreateUser = async () => {
    if (!userForm.username || !userForm.email || !userForm.password) {
      setError('Usuario, email y contrasena son requeridos');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await userService.createUser(userForm);
      setSuccess('Usuario creado exitosamente');
      setShowCreateUserModal(false);
      setUserForm({
        username: '',
        email: '',
        password: '',
        full_name: '',
        is_superuser: false,
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al crear usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleInviteUser = async () => {
    if (!selectedSchoolId || !selectedUserForInvite) {
      setError('Selecciona un usuario');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await permissionService.inviteUser(selectedSchoolId, {
        email: selectedUserForInvite.email,
        role: inviteForm.role,
        is_primary: inviteForm.is_primary,
      });
      setSuccess(`Usuario ${selectedUserForInvite.username} agregado exitosamente`);
      setShowInviteUserModal(false);
      setInviteForm({ email: '', role: 'seller', is_primary: false });
      setSelectedUserForInvite(null);
      setUserSearchQuery('');
      loadSchoolUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al agregar usuario');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInviteModal = () => {
    setShowInviteUserModal(true);
    setSelectedUserForInvite(null);
    setUserSearchQuery('');
    setInviteForm({ email: '', role: 'seller', is_primary: false });
    loadAvailableUsers();
  };

  // Open user detail modal
  const handleOpenUserDetail = (schoolUser: SchoolUser) => {
    setSelectedSchoolUser(schoolUser);
    setShowUserDetailModal(true);
    loadUserSchoolRoles(schoolUser.id);
    setAdminEditEmail(schoolUser.email);
    setAdminEditPassword('');
    setShowAdminPassword(false);
  };

  // Admin: Change user email directly
  const handleAdminChangeEmail = async () => {
    if (!selectedSchoolUser || !adminEditEmail) return;
    if (adminEditEmail === selectedSchoolUser.email) {
      setError('El nuevo email es igual al actual');
      return;
    }
    setAdminEmailSaving(true);
    setError(null);
    try {
      await userService.adminChangeEmail(selectedSchoolUser.id, adminEditEmail);
      setSuccess(`Email actualizado a ${adminEditEmail}`);
      setSelectedSchoolUser({ ...selectedSchoolUser, email: adminEditEmail });
      loadSchoolUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar email');
    } finally {
      setAdminEmailSaving(false);
    }
  };

  // Admin: Reset user password
  const handleAdminResetPassword = async () => {
    if (!selectedSchoolUser || !adminEditPassword) return;
    if (adminEditPassword.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres');
      return;
    }
    setAdminPasswordSaving(true);
    setError(null);
    try {
      await userService.adminResetPassword(selectedSchoolUser.id, adminEditPassword);
      setSuccess('Contrasena actualizada correctamente');
      setAdminEditPassword('');
      setShowAdminPassword(false);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar contrasena');
    } finally {
      setAdminPasswordSaving(false);
    }
  };

  // Admin: Toggle superuser status
  const handleToggleSuperuser = async () => {
    if (!selectedSchoolUser) return;
    setSuperuserSaving(true);
    setError(null);
    try {
      const newStatus = !selectedSchoolUser.is_superuser;
      await userService.adminSetSuperuser(selectedSchoolUser.id, newStatus);
      setSuccess(
        newStatus
          ? `${selectedSchoolUser.username} ahora es superusuario`
          : `${selectedSchoolUser.username} ya no es superusuario`
      );
      // Update local state
      setSelectedSchoolUser({ ...selectedSchoolUser, is_superuser: newStatus });
      loadSchoolUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar estado de superusuario');
    } finally {
      setSuperuserSaving(false);
    }
  };

  // Add role to a different school
  const handleAddSchoolRole = async (
    schoolId: string,
    role: UserRole,
    customRoleId?: string
  ) => {
    if (!selectedSchoolUser) return;
    setSaving(true);
    setError(null);
    try {
      await userService.addUserSchoolRole(selectedSchoolUser.id, schoolId, role, customRoleId);
      setSuccess('Rol agregado exitosamente');
      loadUserSchoolRoles(selectedSchoolUser.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al agregar rol');
    } finally {
      setSaving(false);
    }
  };

  // Update role in a school
  const handleUpdateSchoolRole = async (
    schoolId: string,
    newRole: UserRole,
    customRoleId?: string
  ) => {
    if (!selectedSchoolUser) return;
    setSaving(true);
    setError(null);
    try {
      await userService.updateUserSchoolRole(
        selectedSchoolUser.id,
        schoolId,
        newRole,
        customRoleId
      );
      setSuccess('Rol actualizado exitosamente');
      loadUserSchoolRoles(selectedSchoolUser.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al actualizar rol');
    } finally {
      setSaving(false);
    }
  };

  // Remove role from a school
  const handleRemoveSchoolRole = async (schoolId: string) => {
    if (!selectedSchoolUser) return;
    setSaving(true);
    setError(null);
    try {
      await userService.removeUserSchoolRole(selectedSchoolUser.id, schoolId);
      setSuccess('Rol removido exitosamente');
      loadUserSchoolRoles(selectedSchoolUser.id);
      if (schoolId === selectedSchoolId) {
        loadSchoolUsers();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al remover rol');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateUserRole = async () => {
    if (!selectedSchoolId || !selectedSchoolUser) return;
    setSaving(true);
    setError(null);
    try {
      await permissionService.updateUserRole(selectedSchoolId, selectedSchoolUser.id, editRoleForm);
      setSuccess(`Rol actualizado para ${selectedSchoolUser.username}`);
      setShowEditRoleModal(false);
      setSelectedSchoolUser(null);
      loadSchoolUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al actualizar rol');
    } finally {
      setSaving(false);
    }
  };

  // Toggle user active status
  const handleToggleUserActive = async (schoolUser: SchoolUser) => {
    if (!user?.is_superuser || schoolUser.id === user.id) return;
    setSaving(true);
    setError(null);
    try {
      const newStatus = !schoolUser.is_active;
      await userService.updateUser(schoolUser.id, { is_active: newStatus });
      setSuccess(
        newStatus
          ? `${schoolUser.full_name || schoolUser.username} activado`
          : `${schoolUser.full_name || schoolUser.username} desactivado`
      );
      // Update local state immediately
      setSchoolUsers((prev) =>
        prev.map((u) => (u.id === schoolUser.id ? { ...u, is_active: newStatus } : u))
      );
      // Also update selected user if open in detail modal
      if (selectedSchoolUser?.id === schoolUser.id) {
        setSelectedSchoolUser({ ...selectedSchoolUser, is_active: newStatus });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar estado del usuario');
    } finally {
      setSaving(false);
    }
  };

  // Delete user permanently
  const handleDeleteUser = async () => {
    if (!selectedSchoolUser || !user?.is_superuser) return;
    setDeletingUser(true);
    setError(null);
    try {
      const result = await userService.deleteUser(selectedSchoolUser.id);
      // Backend returns action: "deleted" or "deactivated"
      setSuccess(
        typeof result === 'object' && (result as any)?.message
          ? (result as any).message
          : `Usuario ${selectedSchoolUser.full_name || selectedSchoolUser.username} eliminado`
      );
      setShowDeleteUserModal(false);
      setShowUserDetailModal(false);
      setSelectedSchoolUser(null);
      loadSchoolUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al eliminar usuario');
    } finally {
      setDeletingUser(false);
    }
  };

  const handleRemoveUser = async () => {
    if (!selectedSchoolId || !selectedSchoolUser) return;
    setSaving(true);
    setError(null);
    try {
      await permissionService.removeUser(selectedSchoolId, selectedSchoolUser.id);
      setSuccess(`Usuario ${selectedSchoolUser.username} removido del colegio`);
      setShowRemoveUserModal(false);
      setSelectedSchoolUser(null);
      loadSchoolUsers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al remover usuario');
    } finally {
      setSaving(false);
    }
  };

  if (!selectedSchoolId) {
    return (
      <>
        {/* Toolbar even when no school selected */}
        <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-3 items-center">
          <SchoolSelector
            schools={schools}
            selectedSchoolId={selectedSchoolId}
            onSelect={setSelectedSchoolId}
            loading={schoolsLoading}
            showAllUsersOption={user?.is_superuser}
          />
          {user?.is_superuser && (
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm flex items-center ml-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear Usuario
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-600 mb-2">Selecciona un Colegio</h4>
            <p className="text-gray-500">
              {user?.is_superuser
                ? 'Selecciona un colegio o "Todos los Usuarios" para ver usuarios.'
                : 'Usa el selector de arriba para ver los usuarios.'}
            </p>
          </div>
        </div>
        {/* Create User Modal */}
        <CreateUserModal
          isOpen={showCreateUserModal}
          onClose={() => setShowCreateUserModal(false)}
          userForm={userForm}
          setUserForm={setUserForm}
          onSave={handleCreateUser}
          saving={saving}
        />
      </>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-3 items-center">
        <SchoolSelector
          schools={schools}
          selectedSchoolId={selectedSchoolId}
          onSelect={setSelectedSchoolId}
          loading={schoolsLoading}
          showAllUsersOption={user?.is_superuser}
        />

        {/* Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario o email..."
            value={userSearchTerm}
            onChange={(e) => setUserSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
        </div>

        {/* Role Filter - hide in all users mode */}
        {!isAllUsersMode && (
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value as UserRole | '')}
              className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none bg-white text-sm"
            >
              <option value="">Todos los roles</option>
              <option value="viewer">Visualizador</option>
              <option value="seller">Vendedor</option>
              <option value="admin">Administrador</option>
              <option value="owner">Propietario</option>
            </select>
          </div>
        )}

        {/* All users mode indicator */}
        {isAllUsersMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-sm">
            <Users className="w-4 h-4" />
            <span>Vista global del sistema</span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 ml-auto">
          {user?.is_superuser && (
            <button
              onClick={() => setShowCreateUserModal(true)}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Crear Usuario
            </button>
          )}
          {!isAllUsersMode && (
            <button
              onClick={handleOpenInviteModal}
              disabled={!selectedSchoolId}
              className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4 mr-1" />
              Agregar Usuario
            </button>
          )}
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto p-4">
        <UserList
          users={schoolUsers}
          loading={usersLoading}
          selectedSchool={selectedSchool}
          currentUserId={user?.id}
          isSuperuser={user?.is_superuser || false}
          isAllUsersMode={isAllUsersMode}
          onViewDetail={handleOpenUserDetail}
          onEditRole={(schoolUser) => {
            setSelectedSchoolUser(schoolUser);
            setEditRoleForm({
              role: schoolUser.role || undefined,
              custom_role_id: schoolUser.custom_role_id || undefined,
              is_primary: schoolUser.is_primary,
            });
            setShowEditRoleModal(true);
          }}
          onRemoveUser={(schoolUser) => {
            setSelectedSchoolUser(schoolUser);
            setShowRemoveUserModal(true);
          }}
          onToggleActive={handleToggleUserActive}
          onDeleteUser={(schoolUser) => {
            setSelectedSchoolUser(schoolUser);
            setShowDeleteUserModal(true);
          }}
          saving={saving}
        />
      </div>

      {/* Modals */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        userForm={userForm}
        setUserForm={setUserForm}
        onSave={handleCreateUser}
        saving={saving}
      />

      <InviteUserModal
        isOpen={showInviteUserModal}
        onClose={() => setShowInviteUserModal(false)}
        selectedSchool={selectedSchool}
        inviteForm={inviteForm}
        setInviteForm={setInviteForm}
        availableUsers={availableUsers}
        availableUsersLoading={availableUsersLoading}
        selectedUserForInvite={selectedUserForInvite}
        setSelectedUserForInvite={setSelectedUserForInvite}
        userSearchQuery={userSearchQuery}
        setUserSearchQuery={setUserSearchQuery}
        showUserDropdown={showUserDropdown}
        setShowUserDropdown={setShowUserDropdown}
        loadAvailableUsers={loadAvailableUsers}
        customRoles={customRoles}
        onSave={handleInviteUser}
        saving={saving}
        isSuperuser={user?.is_superuser || false}
      />

      <EditRoleModal
        isOpen={showEditRoleModal}
        onClose={() => setShowEditRoleModal(false)}
        selectedUser={selectedSchoolUser}
        editRoleForm={editRoleForm}
        setEditRoleForm={setEditRoleForm}
        customRoles={customRoles}
        onSave={handleUpdateUserRole}
        saving={saving}
        isSuperuser={user?.is_superuser || false}
      />

      <RemoveUserModal
        isOpen={showRemoveUserModal}
        onClose={() => setShowRemoveUserModal(false)}
        selectedUser={selectedSchoolUser}
        selectedSchool={selectedSchool}
        onConfirm={handleRemoveUser}
        saving={saving}
      />

      <UserDetailModal
        isOpen={showUserDetailModal}
        onClose={() => {
          setShowUserDetailModal(false);
          setSelectedSchoolUser(null);
          setUserSchoolRoles([]);
          setError(null);
          loadSchoolUsers();
        }}
        selectedUser={selectedSchoolUser}
        currentUser={user}
        schools={schools}
        userSchoolRoles={userSchoolRoles}
        userRolesLoading={userRolesLoading}
        globalCustomRoles={globalCustomRoles}
        adminEditEmail={adminEditEmail}
        setAdminEditEmail={setAdminEditEmail}
        adminEditPassword={adminEditPassword}
        setAdminEditPassword={setAdminEditPassword}
        showAdminPassword={showAdminPassword}
        setShowAdminPassword={setShowAdminPassword}
        adminEmailSaving={adminEmailSaving}
        adminPasswordSaving={adminPasswordSaving}
        superuserSaving={superuserSaving}
        onAdminChangeEmail={handleAdminChangeEmail}
        onAdminResetPassword={handleAdminResetPassword}
        onToggleSuperuser={handleToggleSuperuser}
        onToggleActive={handleToggleUserActive}
        onDeleteUser={() => setShowDeleteUserModal(true)}
        onAddSchoolRole={handleAddSchoolRole}
        onUpdateSchoolRole={handleUpdateSchoolRole}
        onRemoveSchoolRole={handleRemoveSchoolRole}
        onRetryLoadRoles={() =>
          selectedSchoolUser && loadUserSchoolRoles(selectedSchoolUser.id)
        }
        saving={saving}
        error={error}
      />

      {/* Delete User Confirmation Modal */}
      {showDeleteUserModal && selectedSchoolUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Eliminar Usuario</h3>
                <p className="text-sm text-gray-500">Esta accion no se puede deshacer</p>
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-800">
                Estas a punto de eliminar a <strong>{selectedSchoolUser.full_name || selectedSchoolUser.username}</strong> ({selectedSchoolUser.email}).
              </p>
              <p className="text-xs text-red-600 mt-1">
                Si el usuario tiene ventas asociadas, sera desactivado en lugar de eliminado.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteUserModal(false)}
                disabled={deletingUser}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deletingUser}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {deletingUser ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Eliminar Usuario
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
