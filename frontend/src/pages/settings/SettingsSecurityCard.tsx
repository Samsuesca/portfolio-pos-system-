/**
 * Security Settings Card
 * Provides buttons to change password and email.
 */
import React from 'react';
import { Lock, Mail } from 'lucide-react';

interface SettingsSecurityCardProps {
  onChangePassword: () => void;
  onChangeEmail: () => void;
}

const SettingsSecurityCard: React.FC<SettingsSecurityCardProps> = ({
  onChangePassword,
  onChangeEmail,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center mb-4">
        <Lock className="w-5 h-5 text-red-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-800">Seguridad</h2>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Cambia tu contrasena o correo electronico.</p>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onChangePassword}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center"
          >
            <Lock className="w-4 h-4 mr-2" />
            Cambiar Contrasena
          </button>
          <button
            onClick={onChangeEmail}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center"
          >
            <Mail className="w-4 h-4 mr-2" />
            Cambiar Correo
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SettingsSecurityCard);
