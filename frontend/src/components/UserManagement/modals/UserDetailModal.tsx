/**
 * UserDetailModal - Modal for viewing user details and managing multi-school roles
 */
import { X, Building2, Loader2, Lock, Mail, Save, Eye, EyeOff, Plus, Trash2, Shield, UserX, UserCheck } from 'lucide-react';
import type { SchoolUser, School, CustomRole, UserRole, UserSchoolRole } from '../types';
import type { User } from '../../../types/api';

interface UserDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUser: SchoolUser | null;
  currentUser: User | null;
  schools: School[];
  userSchoolRoles: UserSchoolRole[];
  userRolesLoading: boolean;
  globalCustomRoles: CustomRole[];
  adminEditEmail: string;
  setAdminEditEmail: (email: string) => void;
  adminEditPassword: string;
  setAdminEditPassword: (password: string) => void;
  showAdminPassword: boolean;
  setShowAdminPassword: (show: boolean) => void;
  adminEmailSaving: boolean;
  adminPasswordSaving: boolean;
  superuserSaving: boolean;
  onAdminChangeEmail: () => void;
  onAdminResetPassword: () => void;
  onToggleSuperuser: () => void;
  onToggleActive?: (user: SchoolUser) => void;
  onDeleteUser?: () => void;
  onAddSchoolRole: (schoolId: string, role: UserRole, customRoleId?: string) => void;
  onUpdateSchoolRole: (schoolId: string, role: UserRole, customRoleId?: string) => void;
  onRemoveSchoolRole: (schoolId: string) => void;
  onRetryLoadRoles: () => void;
  saving: boolean;
  error: string | null;
}

export default function UserDetailModal({
  isOpen,
  onClose,
  selectedUser,
  currentUser,
  schools,
  userSchoolRoles,
  userRolesLoading,
  globalCustomRoles,
  adminEditEmail,
  setAdminEditEmail,
  adminEditPassword,
  setAdminEditPassword,
  showAdminPassword,
  setShowAdminPassword,
  adminEmailSaving,
  adminPasswordSaving,
  superuserSaving,
  onAdminChangeEmail,
  onAdminResetPassword,
  onToggleSuperuser,
  onToggleActive,
  onDeleteUser,
  onAddSchoolRole,
  onUpdateSchoolRole,
  onRemoveSchoolRole,
  onRetryLoadRoles,
  saving,
  error,
}: UserDetailModalProps) {
  if (!isOpen || !selectedUser) return null;

  const handleAddSchool = () => {
    const schoolSelect = document.getElementById('newSchoolSelect') as HTMLSelectElement;
    const roleSelect = document.getElementById('newRoleSelect') as HTMLSelectElement;
    if (schoolSelect.value) {
      const roleValue = roleSelect.value;
      if (roleValue.startsWith('custom:')) {
        const customRoleId = roleValue.replace('custom:', '');
        onAddSchoolRole(schoolSelect.value, 'viewer', customRoleId);
      } else {
        onAddSchoolRole(schoolSelect.value, roleValue as UserRole, undefined);
      }
      schoolSelect.value = '';
      roleSelect.value = 'viewer';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b bg-indigo-50">
          <div>
            <h3 className="text-lg font-semibold text-indigo-900">Detalle de Usuario</h3>
            <p className="text-sm text-indigo-600">Gestionar roles en multiples colegios</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* User Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                selectedUser.is_active ? 'bg-indigo-100' : 'bg-red-100'
              }`}>
                <span className={`text-2xl font-bold ${
                  selectedUser.is_active ? 'text-indigo-600' : 'text-red-400'
                }`}>
                  {selectedUser.full_name?.[0]?.toUpperCase() ||
                    selectedUser.username[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-gray-900">
                    {selectedUser.full_name || selectedUser.username}
                  </h4>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedUser.is_active
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedUser.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                    {selectedUser.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">@{selectedUser.username}</p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {selectedUser.is_superuser && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                      Superusuario
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick actions: Activate/Deactivate + Delete */}
            {currentUser?.is_superuser && selectedUser.id !== currentUser.id && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                {onToggleActive && (
                  <button
                    onClick={() => onToggleActive(selectedUser)}
                    disabled={saving}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition disabled:opacity-50 ${
                      selectedUser.is_active
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {selectedUser.is_active ? (
                      <>
                        <UserX className="w-4 h-4" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        Activar
                      </>
                    )}
                  </button>
                )}
                {onDeleteUser && (
                  <button
                    onClick={onDeleteUser}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Admin: Change Email and Password (superusers can edit anyone except themselves) */}
          {currentUser?.is_superuser &&
            selectedUser.id !== currentUser.id && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center">
                  <Lock className="w-4 h-4 mr-2" />
                  Administracion de Cuenta (Solo Admin)
                </h4>
                <div className="space-y-3">
                  {/* Change Email */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Cambiar Email (sin verificacion)
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="email"
                          value={adminEditEmail}
                          onChange={(e) => setAdminEditEmail(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          placeholder="nuevo@email.com"
                        />
                      </div>
                      <button
                        onClick={onAdminChangeEmail}
                        disabled={
                          adminEmailSaving ||
                          !adminEditEmail ||
                          adminEditEmail === selectedUser.email
                        }
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {adminEmailSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Reset Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Nueva Contrasena
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          value={adminEditPassword}
                          onChange={(e) => setAdminEditPassword(e.target.value)}
                          className="w-full pl-9 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          placeholder="Minimo 6 caracteres"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showAdminPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                      <button
                        onClick={onAdminResetPassword}
                        disabled={
                          adminPasswordSaving ||
                          !adminEditPassword ||
                          adminEditPassword.length < 6
                        }
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      >
                        {adminPasswordSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      El usuario debera usar esta contrasena para iniciar sesion.
                    </p>
                  </div>

                  {/* Toggle Superuser Status */}
                  <div className="border-t border-amber-200 pt-3 mt-3">
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Estado de Superusuario
                    </label>
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <Shield className={`w-5 h-5 ${selectedUser.is_superuser ? 'text-purple-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedUser.is_superuser ? 'Es Superusuario' : 'Usuario Normal'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {selectedUser.is_superuser
                              ? 'Tiene acceso total al sistema'
                              : 'Acceso limitado por roles'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={onToggleSuperuser}
                        disabled={superuserSaving}
                        className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 transition ${
                          selectedUser.is_superuser
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {superuserSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Shield className="w-4 h-4" />
                            {selectedUser.is_superuser ? 'Quitar' : 'Hacer Superuser'}
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-amber-700 mt-2">
                      Los superusuarios tienen acceso completo a todos los colegios y funciones del sistema.
                    </p>
                  </div>
                </div>
              </div>
            )}

          {/* School Roles */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              Roles por Colegio ({userSchoolRoles.length})
            </h4>

            {userRolesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mr-2" />
                <span className="text-gray-500">Cargando roles...</span>
              </div>
            ) : error && userSchoolRoles.length === 0 ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700">Error al cargar roles: {error}</p>
                <button
                  onClick={onRetryLoadRoles}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Reintentar
                </button>
              </div>
            ) : userSchoolRoles.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-yellow-700">
                  Este usuario no tiene roles asignados en ningun colegio.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {userSchoolRoles.map((sr) => (
                  <div
                    key={sr.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-200 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sr.school?.name}</p>
                        <p className="text-xs text-gray-500">Codigo: {sr.school?.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {sr.is_primary && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          Principal
                        </span>
                      )}
                      <select
                        value={
                          sr.custom_role_id
                            ? `custom:${sr.custom_role_id}`
                            : sr.role || 'viewer'
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.startsWith('custom:')) {
                            const customRoleId = value.replace('custom:', '');
                            onUpdateSchoolRole(sr.school_id, sr.role || 'viewer', customRoleId);
                          } else {
                            onUpdateSchoolRole(sr.school_id, value as UserRole, undefined);
                          }
                        }}
                        disabled={saving}
                        className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 min-w-[160px]"
                      >
                        <optgroup label="Roles del Sistema">
                          <option value="viewer">Visualizador</option>
                          <option value="seller">Vendedor</option>
                          <option value="admin">Administrador</option>
                          <option value="owner">Propietario</option>
                        </optgroup>
                        {globalCustomRoles.length > 0 && (
                          <optgroup label="Roles Personalizados">
                            {globalCustomRoles.map((role) => (
                              <option key={role.id} value={`custom:${role.id}`}>
                                {role.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      <button
                        onClick={() => onRemoveSchoolRole(sr.school_id)}
                        disabled={saving}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                        title="Remover de este colegio"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add to new school */}
          {currentUser?.is_superuser && schools.length > userSchoolRoles.length && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Agregar a otro colegio
              </h4>
              <div className="flex flex-wrap gap-2">
                <select
                  id="newSchoolSelect"
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar colegio...</option>
                  {schools
                    .filter((s) => !userSchoolRoles.find((sr) => sr.school_id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                </select>
                <select
                  id="newRoleSelect"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
                >
                  <optgroup label="Roles del Sistema">
                    <option value="viewer">Visualizador</option>
                    <option value="seller">Vendedor</option>
                    <option value="admin">Administrador</option>
                    <option value="owner">Propietario</option>
                  </optgroup>
                  {globalCustomRoles.length > 0 && (
                    <optgroup label="Roles Personalizados">
                      {globalCustomRoles.map((role) => (
                        <option key={role.id} value={`custom:${role.id}`}>
                          {role.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  onClick={handleAddSchool}
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </button>
              </div>
              {globalCustomRoles.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  Los roles personalizados son globales y pueden asignarse en cualquier colegio.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
