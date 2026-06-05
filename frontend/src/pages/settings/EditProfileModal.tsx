/**
 * Edit Profile Modal
 * Allows the user to update their full name and email.
 */
import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Save, Loader2 } from 'lucide-react';
import { userService } from '../../services/userService';
import { useAuthStore } from '../../stores/authStore';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser } = useAuthStore();

  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setProfileForm({
        full_name: user.full_name || '',
        email: user.email || '',
      });
      setError(null);
      setSuccess(false);
    }
  }, [user, isOpen]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const updated = await userService.updateProfile(user.id, {
        full_name: profileForm.full_name || undefined,
        email: profileForm.email,
      });
      updateUser({ full_name: updated.full_name, email: updated.email });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Editar Perfil</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" />
              Perfil actualizado correctamente
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Nombre de usuario</label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full px-3 py-2 border border-stone-200 rounded-lg bg-stone-100 text-stone-500"
            />
            <p className="text-xs text-stone-500 mt-1">El nombre de usuario no se puede cambiar</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Nombre completo</label>
            <input
              type="text"
              value={profileForm.full_name}
              onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent"
              placeholder="Tu nombre completo"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="w-full px-3 py-2 border border-stone-200 rounded-lg focus:ring-2 focus:ring-brand-400/30 focus:border-transparent"
              placeholder="tu@email.com"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-stone-600 hover:text-stone-800 transition">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition flex items-center disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(EditProfileModal);
