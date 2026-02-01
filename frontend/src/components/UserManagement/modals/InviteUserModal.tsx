/**
 * InviteUserModal - Modal for adding existing user to a school
 */
import { X, Search, Loader2 } from 'lucide-react';
import type { School, InviteUserRequest, CustomRole, AvailableUser, UserRole } from '../types';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSchool: School | undefined;
  inviteForm: InviteUserRequest;
  setInviteForm: (form: InviteUserRequest) => void;
  availableUsers: AvailableUser[];
  availableUsersLoading: boolean;
  selectedUserForInvite: AvailableUser | null;
  setSelectedUserForInvite: (user: AvailableUser | null) => void;
  userSearchQuery: string;
  setUserSearchQuery: (query: string) => void;
  showUserDropdown: boolean;
  setShowUserDropdown: (show: boolean) => void;
  loadAvailableUsers: (search?: string) => void;
  customRoles: CustomRole[];
  onSave: () => void;
  saving: boolean;
  isSuperuser: boolean;
}

export default function InviteUserModal({
  isOpen,
  onClose,
  selectedSchool,
  inviteForm,
  setInviteForm,
  availableUsers,
  availableUsersLoading,
  selectedUserForInvite,
  setSelectedUserForInvite,
  userSearchQuery,
  setUserSearchQuery,
  showUserDropdown,
  setShowUserDropdown,
  loadAvailableUsers,
  customRoles,
  onSave,
  saving,
  isSuperuser,
}: InviteUserModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Agregar Usuario al Colegio</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-700">
              <strong>Colegio:</strong> {selectedSchool?.name}
            </p>
          </div>

          {/* User Selection Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Seleccionar Usuario
            </label>
            <div className="relative">
              {selectedUserForInvite ? (
                <div className="flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 font-medium text-sm">
                        {selectedUserForInvite.full_name?.[0]?.toUpperCase() ||
                          selectedUserForInvite.username[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {selectedUserForInvite.full_name || selectedUserForInvite.username}
                      </div>
                      <div className="text-xs text-gray-500">{selectedUserForInvite.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUserForInvite(null);
                      setUserSearchQuery('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setUserSearchQuery(value);
                        setShowUserDropdown(true);
                        if (value.length >= 2) {
                          loadAvailableUsers(value);
                        } else if (value.length === 0) {
                          loadAvailableUsers();
                        }
                      }}
                      onFocus={() => setShowUserDropdown(true)}
                      placeholder="Buscar por nombre, usuario o email (min 2 caracteres)..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Dropdown list */}
                  {showUserDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {availableUsersLoading ? (
                        <div className="p-4 text-center text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Cargando usuarios...
                        </div>
                      ) : availableUsers.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          {userSearchQuery && userSearchQuery.length >= 2
                            ? 'No se encontraron usuarios'
                            : userSearchQuery.length > 0 && userSearchQuery.length < 2
                            ? 'Escribe al menos 2 caracteres para buscar'
                            : 'No hay usuarios disponibles para agregar'}
                        </div>
                      ) : (
                        availableUsers.map((availUser) => (
                          <button
                            key={availUser.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserForInvite(availUser);
                              setShowUserDropdown(false);
                              setUserSearchQuery('');
                            }}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left border-b last:border-b-0"
                          >
                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-gray-600 font-medium text-sm">
                                {availUser.full_name?.[0]?.toUpperCase() ||
                                  availUser.username[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {availUser.full_name || availUser.username}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                @{availUser.username} - {availUser.email}
                              </div>
                            </div>
                            {availUser.is_superuser && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                Super
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rol en el Colegio
            </label>
            <select
              value={inviteForm.role}
              onChange={(e) =>
                setInviteForm({ ...inviteForm, role: e.target.value as UserRole })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="viewer">Visualizador - Solo puede ver informacion</option>
              <option value="seller">Vendedor - Puede crear ventas y pedidos</option>
              <option value="admin">Administrador - Gestion completa excepto usuarios</option>
              {isSuperuser && (
                <option value="owner">Propietario - Acceso total al colegio</option>
              )}
            </select>
          </div>

          {/* Custom Role Selection (if available) */}
          {customRoles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol Personalizado (opcional)
              </label>
              <select
                value={inviteForm.custom_role_id || ''}
                onChange={(e) =>
                  setInviteForm({
                    ...inviteForm,
                    custom_role_id: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sin rol personalizado</option>
                {customRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Primary School Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="invite_is_primary"
              checked={inviteForm.is_primary}
              onChange={(e) => setInviteForm({ ...inviteForm, is_primary: e.target.checked })}
              className="h-4 w-4 text-indigo-600 rounded"
            />
            <label htmlFor="invite_is_primary" className="ml-2 text-sm text-gray-700">
              Establecer como colegio principal del usuario
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || !selectedUserForInvite}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Agregar Usuario
          </button>
        </div>
      </div>
    </div>
  );
}
