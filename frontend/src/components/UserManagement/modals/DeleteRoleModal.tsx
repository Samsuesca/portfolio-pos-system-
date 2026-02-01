/**
 * DeleteRoleModal - Modal for confirming role deletion
 */
import { X, Loader2 } from 'lucide-react';
import type { CustomRole } from '../types';

interface DeleteRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRole: CustomRole | null;
  onConfirm: () => void;
  saving: boolean;
}

export default function DeleteRoleModal({
  isOpen,
  onClose,
  selectedRole,
  onConfirm,
  saving,
}: DeleteRoleModalProps) {
  if (!isOpen || !selectedRole) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-red-600">Eliminar Rol</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-gray-700">
            Estas seguro de que deseas eliminar el rol{' '}
            <span className="font-medium">{selectedRole.name}</span>?
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Los usuarios con este rol asignado volveran a su rol base.
          </p>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
