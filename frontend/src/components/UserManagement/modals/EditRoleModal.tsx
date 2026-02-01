/**
 * EditRoleModal - Modal for editing user role in a school
 */
import { X, Loader2 } from 'lucide-react';
import type { SchoolUser, UpdateUserRoleRequest, CustomRole, UserRole } from '../types';

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUser: SchoolUser | null;
  editRoleForm: UpdateUserRoleRequest;
  setEditRoleForm: (form: UpdateUserRoleRequest) => void;
  customRoles: CustomRole[];
  onSave: () => void;
  saving: boolean;
  isSuperuser: boolean;
}

export default function EditRoleModal({
  isOpen,
  onClose,
  selectedUser,
  editRoleForm,
  setEditRoleForm,
  customRoles,
  onSave,
  saving,
  isSuperuser,
}: EditRoleModalProps) {
  if (!isOpen || !selectedUser) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Editar Rol</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">Usuario:</p>
            <p className="font-medium">{selectedUser.full_name || selectedUser.username}</p>
            <p className="text-sm text-gray-500">{selectedUser.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Rol</label>
            <select
              value={editRoleForm.role || ''}
              onChange={(e) =>
                setEditRoleForm({ ...editRoleForm, role: e.target.value as UserRole })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="viewer">Visualizador (solo lectura)</option>
              <option value="seller">Vendedor</option>
              <option value="admin">Administrador</option>
              {isSuperuser && <option value="owner">Propietario</option>}
            </select>
          </div>
          {customRoles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rol Personalizado (opcional)
              </label>
              <select
                value={editRoleForm.custom_role_id || ''}
                onChange={(e) =>
                  setEditRoleForm({
                    ...editRoleForm,
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
          <div className="flex items-center">
            <input
              type="checkbox"
              id="edit_is_primary"
              checked={editRoleForm.is_primary}
              onChange={(e) =>
                setEditRoleForm({ ...editRoleForm, is_primary: e.target.checked })
              }
              className="h-4 w-4 text-indigo-600 rounded"
            />
            <label htmlFor="edit_is_primary" className="ml-2 text-sm text-gray-700">
              Colegio principal
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
