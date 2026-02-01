'use client';

import { useState, useEffect, Fragment } from 'react';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Users as UsersIcon,
  Shield,
  ChevronDown,
  ChevronUp,
  X,
  Building2,
} from 'lucide-react';
import userService from '@/lib/services/userService';
import schoolService from '@/lib/services/schoolService';
import type { User, School, UserSchoolRole } from '@/lib/api';

const ROLES = [
  { value: 'owner', label: 'Propietario', color: 'bg-purple-100 text-purple-800' },
  { value: 'admin', label: 'Administrador', color: 'bg-blue-100 text-blue-800' },
  { value: 'seller', label: 'Vendedor', color: 'bg-green-100 text-green-800' },
  { value: 'viewer', label: 'Visualizador', color: 'bg-slate-100 text-slate-800' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  // Expanded rows for roles
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userRoles, setUserRoles] = useState<Record<string, UserSchoolRole[]>>({});
  const [loadingRoles, setLoadingRoles] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: '',
    is_superuser: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Role modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleFormData, setRoleFormData] = useState({
    school_id: '',
    role: 'viewer' as 'owner' | 'admin' | 'seller' | 'viewer',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, schoolsData] = await Promise.all([
        userService.list({ include_inactive: true }),
        schoolService.list({ include_inactive: false }),
      ]);
      setUsers(usersData);
      setSchools(schoolsData);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadUserRoles = async (userId: string) => {
    if (userRoles[userId]) {
      setExpandedUserId(expandedUserId === userId ? null : userId);
      return;
    }

    try {
      setLoadingRoles(userId);
      const roles = await userService.getSchoolRoles(userId);
      setUserRoles((prev) => ({ ...prev, [userId]: roles }));
      setExpandedUserId(userId);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cargar roles');
    } finally {
      setLoadingRoles(null);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesActive = showInactive || user.is_active;
    return matchesSearch && matchesActive;
  });

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      full_name: '',
      is_superuser: false,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      full_name: user.full_name || '',
      is_superuser: user.is_superuser,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      if (editingUser) {
        const updateData: any = {
          email: formData.email,
          full_name: formData.full_name,
          is_superuser: formData.is_superuser,
        };
        await userService.update(editingUser.id, updateData);
      } else {
        await userService.create(formData);
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await userService.update(user.id, { is_active: !user.is_active });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al cambiar estado');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`¿Estás seguro de eliminar a ${user.username}?`)) return;

    try {
      await userService.delete(user.id);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al eliminar usuario');
    }
  };

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setRoleFormData({ school_id: '', role: 'viewer' });
    setShowRoleModal(true);
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSaving(true);
      setFormError(null);
      await userService.addSchoolRole(selectedUser.id, roleFormData.school_id, roleFormData.role);
      // Refresh roles
      const roles = await userService.getSchoolRoles(selectedUser.id);
      setUserRoles((prev) => ({ ...prev, [selectedUser.id]: roles }));
      setShowRoleModal(false);
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Error al asignar rol');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (userId: string, schoolId: string, newRole: 'owner' | 'admin' | 'seller' | 'viewer') => {
    try {
      await userService.updateSchoolRole(userId, schoolId, newRole);
      // Refresh roles
      const roles = await userService.getSchoolRoles(userId);
      setUserRoles((prev) => ({ ...prev, [userId]: roles }));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al actualizar rol');
    }
  };

  const handleRemoveRole = async (userId: string, schoolId: string) => {
    if (!confirm('¿Estás seguro de quitar este rol?')) return;

    try {
      await userService.removeSchoolRole(userId, schoolId);
      const roles = await userService.getSchoolRoles(userId);
      setUserRoles((prev) => ({ ...prev, [userId]: roles }));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al quitar rol');
    }
  };

  const getRoleLabel = (role: string) => {
    return ROLES.find((r) => r.value === role)?.label || role;
  };

  const getRoleColor = (role: string) => {
    return ROLES.find((r) => r.value === role)?.color || 'bg-slate-100 text-slate-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Usuarios
          </h1>
          <p className="text-slate-600 mt-1">
            Gestiona los usuarios y sus roles por colegio
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por usuario, email o nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="admin-input pl-10"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-600">Mostrar inactivos</span>
        </label>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="w-10"></th>
                <th>Usuario</th>
                <th>Email</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Colegios</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-brand-500"></div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500">
                    <UsersIcon className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <Fragment key={user.id}>
                    <tr>
                      <td className="w-10">
                        <button
                          onClick={() => loadUserRoles(user.id)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                        >
                          {loadingRoles === user.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : expandedUserId === user.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="font-medium">{user.username}</td>
                      <td className="text-slate-600">{user.email}</td>
                      <td className="text-slate-600">{user.full_name || '-'}</td>
                      <td>
                        {user.is_superuser ? (
                          <span className="inline-flex items-center gap-1 badge bg-amber-100 text-amber-800">
                            <Shield className="w-3 h-3" />
                            Superuser
                          </span>
                        ) : (
                          <span className="badge badge-default">Usuario</span>
                        )}
                      </td>
                      <td>
                        {user.is_superuser ? (
                          <span className="text-slate-400 text-sm">Todos</span>
                        ) : userRoles[user.id] ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {userRoles[user.id].length} {userRoles[user.id].length === 1 ? 'colegio' : 'colegios'}
                          </span>
                        ) : (
                          <button
                            onClick={() => loadUserRoles(user.id)}
                            className="text-sm text-brand-600 hover:underline"
                          >
                            Ver roles
                          </button>
                        )}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            user.is_active ? 'badge-success' : 'badge-error'
                          }`}
                        >
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openRoleModal(user)}
                            className="p-2 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                            title="Asignar rol"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-slate-600 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(user)}
                            className={`p-2 rounded-lg transition-colors ${
                              user.is_active
                                ? 'text-orange-600 hover:bg-orange-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={user.is_active ? 'Desactivar' : 'Activar'}
                          >
                            {user.is_active ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Roles Row */}
                    {expandedUserId === user.id && userRoles[user.id] && (
                      <tr>
                        <td colSpan={8} className="bg-slate-50 px-8 py-4">
                          <div className="text-sm">
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-medium text-slate-700">
                                Roles por Colegio:
                              </p>
                              <button
                                onClick={() => openRoleModal(user)}
                                className="text-brand-600 hover:text-brand-700 text-sm flex items-center gap-1"
                              >
                                <Plus className="w-4 h-4" />
                                Agregar acceso
                              </button>
                            </div>
                            {userRoles[user.id].length === 0 ? (
                              <p className="text-slate-500">
                                No tiene roles asignados. {!user.is_superuser && 'Agrega un rol para darle acceso a un colegio.'}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {userRoles[user.id].map((role) => (
                                  <div
                                    key={role.school_id}
                                    className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200"
                                  >
                                    <span className="font-medium text-slate-800">
                                      {role.school?.name || 'Colegio'}
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <select
                                        value={role.role}
                                        onChange={(e) => handleUpdateRole(user.id, role.school_id, e.target.value as 'owner' | 'admin' | 'seller' | 'viewer')}
                                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                                      >
                                        {ROLES.map((r) => (
                                          <option key={r.value} value={r.value}>
                                            {r.label}
                                          </option>
                                        ))}
                                      </select>
                                      <button
                                        onClick={() => handleRemoveRole(user.id, role.school_id)}
                                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Quitar acceso"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="admin-label">Usuario *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="admin-input"
                  required
                  disabled={!!editingUser}
                  placeholder="nombre_usuario"
                />
              </div>

              <div>
                <label className="admin-label">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="admin-input"
                  required
                  placeholder="usuario@email.com"
                />
              </div>

              <div>
                <label className="admin-label">Nombre Completo</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className="admin-input"
                  placeholder="Nombre completo"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="admin-label">Contraseña *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="admin-input"
                    required
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                  />
                </div>
              )}

              <label className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_superuser}
                  onChange={(e) =>
                    setFormData({ ...formData, is_superuser: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-amber-300 text-amber-500 focus:ring-amber-500"
                />
                <div>
                  <span className="font-medium text-amber-800">Superusuario</span>
                  <p className="text-xs text-amber-600">
                    Acceso completo a todas las funciones del sistema
                  </p>
                </div>
              </label>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving
                    ? 'Guardando...'
                    : editingUser
                    ? 'Guardar Cambios'
                    : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Asignar Rol
            </h2>
            <p className="text-slate-600 mb-6">
              Usuario: <strong>{selectedUser.username}</strong>
            </p>

            <form onSubmit={handleAddRole} className="space-y-4">
              <div>
                <label className="admin-label">Colegio *</label>
                <select
                  value={roleFormData.school_id}
                  onChange={(e) =>
                    setRoleFormData({ ...roleFormData, school_id: e.target.value })
                  }
                  className="admin-input"
                  required
                >
                  <option value="">Seleccionar colegio</option>
                  {schools
                    .filter((school) => {
                      // Filter out schools where user already has a role
                      const existingRoles = userRoles[selectedUser.id] || [];
                      return !existingRoles.some((r) => r.school_id === school.id);
                    })
                    .map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="admin-label">Rol *</label>
                <select
                  value={roleFormData.role}
                  onChange={(e) =>
                    setRoleFormData({
                      ...roleFormData,
                      role: e.target.value as typeof roleFormData.role,
                    })
                  }
                  className="admin-input"
                  required
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving ? 'Asignando...' : 'Asignar Rol'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
