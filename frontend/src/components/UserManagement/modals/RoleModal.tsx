/**
 * RoleModal - Modal for creating/editing custom roles
 */
import { X, Loader2, Save } from 'lucide-react';
import PermissionEditor from '../PermissionEditor';
import type { CustomRole, CreateRoleRequest, PermissionCatalog } from '../types';

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRole: CustomRole | null;
  roleForm: CreateRoleRequest;
  setRoleForm: (form: CreateRoleRequest) => void;
  permissionCatalog: PermissionCatalog | null;
  expandedCategories: Set<string>;
  onTogglePermission: (permissionCode: string) => void;
  onToggleCategory: (categoryCode: string) => void;
  onCopyPermissionsFromRole: (roleCode: string) => void;
  onSelectCategoryAll: (categoryCode: string, select: boolean) => void;
  onSave: () => void;
  saving: boolean;
}

export default function RoleModal({
  isOpen,
  onClose,
  selectedRole,
  roleForm,
  setRoleForm,
  permissionCatalog,
  expandedCategories,
  onTogglePermission,
  onToggleCategory,
  onCopyPermissionsFromRole,
  onSelectCategoryAll,
  onSave,
  saving,
}: RoleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {selectedRole ? 'Editar Rol Personalizado' : 'Crear Rol Personalizado'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Role Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Cajero Avanzado"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Codigo *</label>
              <input
                type="text"
                value={roleForm.code}
                onChange={(e) =>
                  setRoleForm({
                    ...roleForm,
                    code: e.target.value.toLowerCase().replace(/\s/g, '_'),
                  })
                }
                disabled={!!selectedRole}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                placeholder="cajero_avanzado"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
            <textarea
              value={roleForm.description}
              onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="Vendedor con acceso a reportes basicos"
            />
          </div>

          {/* Copy from role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Copiar permisos de:
            </label>
            <select
              onChange={(e) => e.target.value && onCopyPermissionsFromRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              value=""
            >
              <option value="">Seleccionar rol base...</option>
              <option value="viewer">Visualizador</option>
              <option value="seller">Vendedor</option>
              <option value="admin">Administrador</option>
              <option value="owner">Propietario</option>
            </select>
          </div>

          {/* Permission Editor */}
          <PermissionEditor
            permissionCatalog={permissionCatalog}
            selectedPermissions={(roleForm.permissions || []) as string[]}
            expandedCategories={expandedCategories}
            onTogglePermission={onTogglePermission}
            onToggleCategory={onToggleCategory}
            onSelectAll={() => {
              if (permissionCatalog) {
                setRoleForm({
                  ...roleForm,
                  permissions: permissionCatalog.permissions.map((p) => p.code),
                });
              }
            }}
            onClearAll={() => setRoleForm({ ...roleForm, permissions: [] })}
            onSelectCategoryAll={onSelectCategoryAll}
          />
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || !roleForm.name || !roleForm.code}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            <Save className="w-4 h-4 mr-2" />
            Guardar Rol
          </button>
        </div>
      </div>
    </div>
  );
}
