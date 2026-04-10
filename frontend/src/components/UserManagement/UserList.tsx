/**
 * UserList - Table displaying users in a school with actions
 */
import { Users, Eye, Edit2, Trash2, Loader2, Shield, UserX, UserCheck, MoreVertical } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
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
  onToggleActive?: (user: SchoolUser) => void;
  onDeleteUser?: (user: SchoolUser) => void;
  saving?: boolean;
}

function ActionMenu({
  schoolUser,
  currentUserId,
  isSuperuser,
  isAllUsersMode,
  onViewDetail,
  onEditRole,
  onRemoveUser,
  onToggleActive,
  onDeleteUser,
  saving,
}: {
  schoolUser: SchoolUser;
  currentUserId: string | undefined;
  isSuperuser: boolean;
  isAllUsersMode: boolean;
  onViewDetail: (user: SchoolUser) => void;
  onEditRole: (user: SchoolUser) => void;
  onRemoveUser: (user: SchoolUser) => void;
  onToggleActive?: (user: SchoolUser) => void;
  onDeleteUser?: (user: SchoolUser) => void;
  saving?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isSelf = schoolUser.id === currentUserId;
  const canManage = isSuperuser && !isSelf;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
        title="Acciones"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
          {/* View Detail */}
          {isSuperuser && (
            <button
              onClick={() => { onViewDetail(schoolUser); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Eye className="w-4 h-4 text-gray-500" />
              Ver detalles
            </button>
          )}

          {/* Edit Role - only in school context */}
          {!isAllUsersMode && canManage && (
            <button
              onClick={() => { onEditRole(schoolUser); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Edit2 className="w-4 h-4 text-blue-500" />
              Editar rol
            </button>
          )}

          {/* Toggle Active */}
          {canManage && onToggleActive && (
            <button
              onClick={() => { onToggleActive(schoolUser); setOpen(false); }}
              disabled={saving}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 transition disabled:opacity-50"
            >
              {schoolUser.is_active ? (
                <>
                  <UserX className="w-4 h-4 text-amber-500" />
                  <span className="text-gray-700">Desactivar</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">Activar</span>
                </>
              )}
            </button>
          )}

          {/* Separator before destructive actions */}
          {canManage && (onDeleteUser || !isAllUsersMode) && (
            <div className="border-t border-gray-100 my-1" />
          )}

          {/* Remove from school - only in school context */}
          {!isAllUsersMode && canManage && (
            <button
              onClick={() => { onRemoveUser(schoolUser); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 transition"
            >
              <UserX className="w-4 h-4" />
              Remover del colegio
            </button>
          )}

          {/* Delete User */}
          {canManage && onDeleteUser && (
            <button
              onClick={() => { onDeleteUser(schoolUser); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar usuario
            </button>
          )}

          {/* Self indicator */}
          {isSelf && (
            <div className="px-3 py-2 text-xs text-gray-400">
              Tu cuenta
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  onToggleActive,
  onDeleteUser,
  saving,
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
          {users.map((schoolUser) => {
            const isSelf = schoolUser.id === currentUserId;
            const canToggle = isSuperuser && !isSelf && onToggleActive;

            return (
              <tr
                key={schoolUser.id}
                className={`hover:bg-gray-50 ${!schoolUser.is_active ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      schoolUser.is_active ? 'bg-gray-200' : 'bg-red-100'
                    }`}>
                      <span className={`font-medium text-sm ${
                        schoolUser.is_active ? 'text-gray-600' : 'text-red-400'
                      }`}>
                        {schoolUser.full_name?.[0]?.toUpperCase() ||
                          schoolUser.username[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="ml-3">
                      <div className={`text-sm font-medium ${schoolUser.is_active ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                        {schoolUser.full_name || schoolUser.username}
                        {isSelf && (
                          <span className="ml-1.5 text-xs font-normal text-indigo-500">(tu)</span>
                        )}
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
                  {canToggle ? (
                    <button
                      onClick={() => onToggleActive(schoolUser)}
                      disabled={saving}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                        schoolUser.is_active
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-red-100 text-red-800 hover:bg-red-200'
                      }`}
                      title={schoolUser.is_active ? 'Click para desactivar' : 'Click para activar'}
                    >
                      {schoolUser.is_active ? (
                        <>
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          Activo
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                          Inactivo
                        </>
                      )}
                    </button>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                        schoolUser.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${schoolUser.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      {schoolUser.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <div className="flex justify-end items-center gap-1">
                    {/* Quick view button always visible */}
                    {isSuperuser && (
                      <button
                        onClick={() => onViewDetail(schoolUser)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Ver detalles y roles"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}

                    {/* Action menu with all options */}
                    {isSuperuser && (
                      <ActionMenu
                        schoolUser={schoolUser}
                        currentUserId={currentUserId}
                        isSuperuser={isSuperuser}
                        isAllUsersMode={isAllUsersMode}
                        onViewDetail={onViewDetail}
                        onEditRole={onEditRole}
                        onRemoveUser={onRemoveUser}
                        onToggleActive={onToggleActive}
                        onDeleteUser={onDeleteUser}
                        saving={saving}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
