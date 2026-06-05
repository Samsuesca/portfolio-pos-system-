import React, { useState } from 'react';
import { User, Edit2, Link, Unlink } from 'lucide-react';
import RoleBadge from '../../components/RoleBadge';
import apiClient from '../../utils/api-client';

interface UserInfo {
  username?: string;
  full_name?: string | null;
  email?: string;
  is_superuser?: boolean;
  google_id?: string | null;
  auth_provider?: string | null;
}

interface SettingsProfileCardProps {
  user: UserInfo | null;
  onEditProfile: () => void;
  onUserUpdate?: () => void;
}

const SettingsProfileCard: React.FC<SettingsProfileCardProps> = ({ user, onEditProfile, onUserUpdate }) => {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);

  const isGoogleLinked = !!user?.google_id;

  const handleStartGoogleLink = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;
    const redirectUri = `${window.location.origin}/auth/google/link-callback`;
    const nonce = Math.random().toString(36).substring(2);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce,
      prompt: 'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleUnlinkGoogle = async () => {
    setGoogleLoading(true);
    setGoogleMessage(null);
    try {
      await apiClient.post('/auth/unlink-google');
      setGoogleMessage('Cuenta de Google desvinculada');
      onUserUpdate?.();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGoogleMessage(detail || 'Error al desvincular Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center mb-4">
        <User className="w-5 h-5 text-brand-600 mr-2" />
        <h2 className="text-lg font-semibold text-stone-800">Perfil de Usuario</h2>
      </div>
      <div className="space-y-3">
        <div>
          <label className="text-sm text-stone-600">Nombre de usuario</label>
          <p className="text-stone-800 font-medium">{user?.username}</p>
        </div>
        <div>
          <label className="text-sm text-stone-600">Nombre completo</label>
          <p className="text-stone-800 font-medium">{user?.full_name || 'No especificado'}</p>
        </div>
        <div>
          <label className="text-sm text-stone-600">Email</label>
          <p className="text-stone-800 font-medium">{user?.email}</p>
        </div>
        <div>
          <label className="text-sm text-stone-600">Rol</label>
          <p className="text-stone-800 font-medium mt-1">
            {user?.is_superuser ? (
              <RoleBadge role="superuser" />
            ) : (
              <span className="px-2 py-1 bg-stone-100 text-stone-600 rounded-full text-xs">Usuario regular</span>
            )}
          </p>
        </div>

        {/* Google Account */}
        <div className="pt-3 border-t border-stone-100">
          <label className="text-sm text-stone-600">Cuenta de Google</label>
          {isGoogleLinked ? (
            <div className="mt-1 flex items-center gap-3">
              <span className="text-sm text-green-700 bg-green-50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <Link className="w-3.5 h-3.5" />
                Vinculada
              </span>
              <button
                onClick={handleUnlinkGoogle}
                disabled={googleLoading}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" />
                Desvincular
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleStartGoogleLink}
                disabled={googleLoading}
                className="flex items-center gap-2.5 px-4 py-2.5 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="text-sm font-medium text-stone-700">Vincular cuenta de Google</span>
              </button>
            </div>
          )}
          {googleMessage && (
            <p className={`text-xs mt-1.5 ${googleMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {googleMessage}
            </p>
          )}
        </div>

        <button
          onClick={onEditProfile}
          className="mt-4 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition flex items-center"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Editar Perfil
        </button>
      </div>
    </div>
  );
};

export default React.memo(SettingsProfileCard);
