/**
 * RemoveUserModal - Modal for confirming user removal from school
 */
import { X, Loader2 } from 'lucide-react';
import type { SchoolUser, School } from '../types';

interface RemoveUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUser: SchoolUser | null;
  selectedSchool: School | undefined;
  onConfirm: () => void;
  saving: boolean;
}

export default function RemoveUserModal({
  isOpen,
  onClose,
  selectedUser,
  selectedSchool,
  onConfirm,
  saving,
}: RemoveUserModalProps) {
  if (!isOpen || !selectedUser) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-red-600">Confirmar Eliminacion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-gray-700">
            Estas seguro de que deseas remover a{' '}
            <span className="font-medium">
              {selectedUser.full_name || selectedUser.username}
            </span>{' '}
            de <span className="font-medium">{selectedSchool?.name}</span>?
          </p>
          <p className="mt-2 text-sm text-gray-500">
            El usuario perdera acceso a este colegio pero su cuenta no sera eliminada.
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
            Remover
          </button>
        </div>
      </div>
    </div>
  );
}
