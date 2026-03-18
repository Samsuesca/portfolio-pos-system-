/**
 * Server Configuration Card
 * Allows the user to select or enter the API server URL.
 */
import React from 'react';
import { Server, CheckCircle, XCircle } from 'lucide-react';
import {
  ENVIRONMENTS,
  ENVIRONMENT_LABELS,
  ENVIRONMENT_DESCRIPTIONS,
  type EnvironmentKey,
} from '../../config/environments';

interface SettingsServerCardProps {
  apiUrl: string;
  setApiUrl: (url: string) => void;
  isOnline: boolean;
  customUrl: string;
  setCustomUrl: (url: string) => void;
}

const SettingsServerCard: React.FC<SettingsServerCardProps> = ({
  apiUrl,
  setApiUrl,
  isOnline,
  customUrl,
  setCustomUrl,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Server className="w-5 h-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-800">Configuracion del Servidor</h2>
        </div>
        <div className="flex items-center">
          {isOnline ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">Conectado</span>
            </div>
          ) : (
            <div className="flex items-center text-red-600">
              <XCircle className="w-4 h-4 mr-1" />
              <span className="text-sm">Desconectado</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Selecciona el servidor al que deseas conectarte.
        </p>

        {/* Environment Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Entorno</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(Object.keys(ENVIRONMENTS) as EnvironmentKey[]).map((env) => (
              <button
                key={env}
                onClick={() => {
                  const url = ENVIRONMENTS[env];
                  setApiUrl(url);
                  setCustomUrl(url);
                }}
                className={`p-4 border-2 rounded-lg text-left transition ${
                  apiUrl === ENVIRONMENTS[env]
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="font-semibold text-gray-800 mb-1">{ENVIRONMENT_LABELS[env]}</div>
                <div className="text-xs text-gray-600">{ENVIRONMENT_DESCRIPTIONS[env]}</div>
                <div className="text-xs text-gray-500 mt-2 font-mono break-all">{ENVIRONMENTS[env]}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">URL Personalizada</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="http://192.168.1.100:8000"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={() => setApiUrl(customUrl)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
            >
              Aplicar
            </button>
          </div>
        </div>

        {/* Current URL Display */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <div className="text-sm font-medium text-gray-700">Servidor Actual:</div>
          <div className="text-sm text-gray-600 font-mono mt-1">{apiUrl}/api/v1</div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(SettingsServerCard);
