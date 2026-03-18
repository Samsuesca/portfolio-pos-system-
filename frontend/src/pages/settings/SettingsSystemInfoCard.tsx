/**
 * System Information Card
 * Dark-themed footer card showing app version, server status, and user info.
 */
import React from 'react';
import { Settings as SettingsIcon, Server, User } from 'lucide-react';
import { SYSTEM_VERSION, APP_VERSION } from '../../config/version';

interface UserInfo {
  username?: string;
  full_name?: string | null;
  is_superuser?: boolean;
}

interface SettingsSystemInfoCardProps {
  user: UserInfo | null;
  apiUrl: string;
  isOnline: boolean;
  businessName: string;
  tagline: string;
}

const SettingsSystemInfoCard: React.FC<SettingsSystemInfoCardProps> = ({
  user,
  apiUrl,
  isOnline,
  businessName,
  tagline,
}) => {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 mt-6 text-white shadow-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <img src="/icon.png" alt="Logo" className="h-14 w-14 object-contain" />
          <div>
            <h3 className="text-xl font-bold">
              {businessName || 'Sistema de Gestion'}
            </h3>
            {tagline && (
              <p className="text-slate-400 text-sm">{tagline}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="px-3 py-1 bg-brand-600 rounded-full text-xs font-semibold">
            v{SYSTEM_VERSION}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Connection Status */}
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Server className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">Servidor</span>
          </div>
          <p className="font-mono text-sm truncate" title={apiUrl}>{apiUrl}</p>
          <div className="flex items-center gap-1.5 mt-2">
            {isOnline ? (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400">Conectado</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-xs text-red-400">Sin conexion</span>
              </>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">Usuario</span>
          </div>
          <p className="font-medium">{user?.full_name || user?.username}</p>
          <div className="flex items-center gap-2 mt-2">
            {user?.is_superuser ? (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded text-xs font-medium">
                Superusuario
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-500/30 text-slate-300 rounded text-xs">
                Usuario
              </span>
            )}
          </div>
        </div>

        {/* App Version */}
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <SettingsIcon className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">Version</span>
          </div>
          <p className="font-medium">Sistema v{SYSTEM_VERSION}</p>
          <p className="text-xs text-slate-400 mt-1">App v{APP_VERSION}</p>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SettingsSystemInfoCard);
