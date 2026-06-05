/**
 * CustomRolesList - Display and manage custom roles
 */
import { Shield, Edit2, Trash2 } from 'lucide-react';
import type { CustomRole } from './types';

interface CustomRolesListProps {
  roles: CustomRole[];
  onCreateRole: () => void;
  onEditRole: (role: CustomRole) => void;
  onDeleteRole: (role: CustomRole) => void;
}

export default function CustomRolesList({
  roles,
  onCreateRole,
  onEditRole,
  onDeleteRole,
}: CustomRolesListProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-stone-700 mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        Roles Personalizados
      </h3>
      {roles.length === 0 ? (
        <div className="text-center py-8 bg-stone-50 rounded-lg border border-dashed border-stone-200">
          <Shield className="w-10 h-10 text-stone-400 mx-auto mb-3" />
          <p className="text-stone-500">No hay roles personalizados creados</p>
          <button
            onClick={onCreateRole}
            className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
          >
            Crear primer rol
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-100">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Rol
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Codigo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Permisos
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                  Descripcion
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-100">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: role.color ? `${role.color}20` : '#e5e7eb',
                        color: role.color || '#374151',
                      }}
                    >
                      {role.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500 font-mono">
                    {role.code}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-500">
                    {role.permissions.length} permisos
                  </td>
                  <td className="px-4 py-3 text-sm text-stone-500 max-w-xs truncate">
                    {role.description || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onEditRole(role)}
                        className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition"
                        title="Editar rol"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteRole(role)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar rol"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
