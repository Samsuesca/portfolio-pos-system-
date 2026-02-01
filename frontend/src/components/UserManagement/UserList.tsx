/**
 * UserList - Table displaying users in a school with actions
 */
import { Users, Eye, Edit2, Trash2, Loader2, Shield } from 'lucide-react';
import RoleBadge, { getUserDisplayRole } from '../RoleBadge';
import type { SchoolUser, School } from './types';

interface UserListProps {
  users: SchoolUser[];
  loading: boolean;
  selectedSchool: School | undefined;
  currentUserId: string | undefined;
  isSuperuser: boolean;
  isAllUsersMode?: boolean;
  onViewDetail: (user: SchoolUser) => void;
  onEditRole: (user: SchoolUser) => void;
  onRemoveUser: (user: SchoolUser) => void;
}

export default function UserList({
  users,
  loading,
  selectedSchool,
  currentUserId,
  isSuperuser,
  isAllUsersMode = false,
  onViewDetail,
  onEditRole,
  onRemoveUser,
}: UserListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-600">Cargando usuarios...</span>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>
          {isAllUsersMode
            ? 'No hay usuarios en el sistema'
            : `No hay usuarios en ${selectedSchool?.name || 'este colegio'}`}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Usuario
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Email
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Rol
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Estado
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((schoolUser) => (
            <tr key={schoolUser.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 font-medium text-sm">
                      {schoolUser.full_name?.[0]?.toUpperCase() ||
                        schoolUser.username[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-gray-900">
                      {schoolUser.full_name || schoolUser.username}
                    </div>
                    <div className="text-xs text-gray-500">@{schoolUser.username}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                {schoolUser.email}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {isAllUsersMode ? (
                  // In all users mode, show superuser badge or "Sin asignar"
                  schoolUser.is_superuser ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      <Shield className="w-3 h-3" />
                      Superusuario
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Usuario
                    </span>
                  )
                ) : schoolUser.custom_role_name ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                    {schoolUser.custom_role_name}
                  </span>
                ) : (
                  <RoleBadge
                    role={getUserDisplayRole(schoolUser.is_superuser, schoolUser.role)}
                    size="sm"
                  />
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    schoolUser.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {schoolUser.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-right">
                <div className="flex justify-end gap-1">
                  {/* View details button - always visible for superusers */}
                  {isSuperuser && (
                    <button
                      onClick={() => onViewDetail(schoolUser)}
                      className="p-1.5 text-gray-600 hover:bg-gray-50 rounded-lg transition"
                      title="Ver detalles y roles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  {/* Edit/Remove buttons - only in school context (not in all users mode) */}
                  {!isAllUsersMode &&
                    schoolUser.id !== currentUserId &&
                    (isSuperuser || !schoolUser.is_superuser) && (
                      <>
                        <button
                          onClick={() => onEditRole(schoolUser)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Editar rol en este colegio"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRemoveUser(schoolUser)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Remover de este colegio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  {schoolUser.id === currentUserId && (
                    <span className="text-gray-400 text-xs">Tu</span>
                  )}
                  {schoolUser.is_superuser &&
                    schoolUser.id !== currentUserId &&
                    !isSuperuser && <span className="text-gray-400 text-xs">Superuser</span>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
