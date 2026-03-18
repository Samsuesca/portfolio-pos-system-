/**
 * User Profile Card
 * Displays current user information and an edit button.
 */
import React from 'react';
import { User, Edit2 } from 'lucide-react';
import RoleBadge from '../../components/RoleBadge';

interface UserInfo {
  username?: string;
  full_name?: string | null;
  email?: string;
  is_superuser?: boolean;
}

interface SettingsProfileCardProps {
  user: UserInfo | null;
  onEditProfile: () => void;
}

const SettingsProfileCard: React.FC<SettingsProfileCardProps> = ({ user, onEditProfile }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center mb-4">
        <User className="w-5 h-5 text-blue-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-800">Perfil de Usuario</h2>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-gray-600">Nombre de usuario</label>
          <p className="text-gray-800 font-medium">{user?.username}</p>
        </div>
        <div>
          <label className="text-sm text-gray-600">Nombre completo</label>
          <p className="text-gray-800 font-medium">{user?.full_name || 'No especificado'}</p>
        </div>
        <div>
          <label className="text-sm text-gray-600">Email</label>
          <p className="text-gray-800 font-medium">{user?.email}</p>
        </div>
        <div>
          <label className="text-sm text-gray-600">Rol</label>
          <p className="text-gray-800 font-medium mt-1">
            {user?.is_superuser ? (
              <RoleBadge role="superuser" />
            ) : (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">Usuario regular</span>
            )}
          </p>
        </div>
        <button
          onClick={onEditProfile}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar Perfil
        </button>
      </div>
    </div>
  );
};

export default React.memo(SettingsProfileCard);
