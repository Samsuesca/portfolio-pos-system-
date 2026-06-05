/**
 * CreateUserModal - Modal for creating a new user
 */
import { X, Loader2 } from 'lucide-react';
import type { UserCreate } from '../types';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  userForm: UserCreate;
  setUserForm: (form: UserCreate) => void;
  onSave: () => void;
  saving: boolean;
}

export default function CreateUserModal({
  isOpen,
  onClose,
  userForm,
  setUserForm,
  onSave,
  saving,
}: CreateUserModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Nuevo Usuario</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Usuario *</label>
            <input
              type="text"
              value={userForm.username}
              onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30"
              placeholder="juanperez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={userForm.full_name}
              onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30"
              placeholder="Juan Perez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email *</label>
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30"
              placeholder="juan@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Contrasena *</label>
            <input
              type="password"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30"
              placeholder="Minimo 6 caracteres"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="create_is_superuser"
              checked={userForm.is_superuser}
              onChange={(e) => setUserForm({ ...userForm, is_superuser: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded"
            />
            <label htmlFor="create_is_superuser" className="ml-2 text-sm text-stone-700">
              Es superusuario (acceso total a todos los colegios)
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-stone-600 hover:text-stone-800"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={saving || !userForm.username || !userForm.email || !userForm.password}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear Usuario
          </button>
        </div>
      </div>
    </div>
  );
}
