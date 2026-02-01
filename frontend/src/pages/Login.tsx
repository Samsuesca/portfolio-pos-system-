/**
 * Login Page - User authentication screen
 */
import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { ENVIRONMENTS, ENVIRONMENT_LABELS, ENVIRONMENT_DESCRIPTIONS, type EnvironmentKey } from '../config/environments';
import { LogIn, AlertCircle, Settings, Loader2, Wifi, WifiOff } from 'lucide-react';
import { SYSTEM_VERSION } from '../config/version';
import { invoke } from '@tauri-apps/api/core';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { apiUrl, setApiUrl } = useConfigStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [selectedServer, setSelectedServer] = useState<string>(apiUrl);
  const [testingServer, setTestingServer] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<Record<string, 'success' | 'error' | 'testing'>>({});

  const selectServer = async (url: string) => {
    setSelectedServer(url);
    setTestingServer(url);
    setServerStatus(prev => ({ ...prev, [url]: 'testing' }));

    // Timeout manual de 3 segundos
    const timeoutId = setTimeout(() => {
      setServerStatus(prev => ({ ...prev, [url]: 'error' }));
      setTestingServer(null);
    }, 3000);

    try {
      const isDevMode = import.meta.env.DEV;
      let isHealthy = false;

      if (isDevMode) {
        // Dev mode: use fetch directly (Rust IPC has issues with localhost)
        const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
        isHealthy = response.ok;
      } else {
        // Production build: use Rust IPC (avoids Windows WebView2 bugs)
        const response = await invoke<{ status: number; body: string }>('http_request', {
          request: {
            method: 'GET',
            url: `${url}/health`,
            headers: {},
            timeout_secs: 3,
          },
        });
        isHealthy = response.status >= 200 && response.status < 300;
      }

      clearTimeout(timeoutId);
      if (isHealthy) {
        setServerStatus(prev => ({ ...prev, [url]: 'success' }));
        setApiUrl(url);
      } else {
        setServerStatus(prev => ({ ...prev, [url]: 'error' }));
      }
    } catch {
      clearTimeout(timeoutId);
      setServerStatus(prev => ({ ...prev, [url]: 'error' }));
    }
    setTestingServer(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      await login({ username, password });
      navigate('/dashboard');
    } catch (err) {
      // Error is already set in store
      console.error('Login failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-surface-200 w-full max-w-md p-8 relative overflow-hidden">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#B8860B] to-[#D4A017]"></div>

        {/* Logo/Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="UCR - Uniformes Consuelo Rios"
            className="h-32 mx-auto mb-4 drop-shadow-md"
          />
          <p className="text-slate-500 font-medium">Inicia sesión para continuar</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username Input */}
          <div>
            <label htmlFor="username" className="block text-sm font-semibold text-slate-700 mb-2">
              Usuario o Email
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all duration-200 bg-surface-50 focus:bg-white text-slate-800 placeholder-slate-400"
              placeholder="admin"
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all duration-200 bg-surface-50 focus:bg-white text-slate-800 placeholder-slate-400"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20 hover:shadow-brand-600/40 hover:-translate-y-0.5"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Iniciando sesión...
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5 mr-2" />
                Iniciar Sesión
              </>
            )}
          </button>
        </form>

        {/* Server Configuration Toggle */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="w-full flex items-center justify-center text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Settings className="w-4 h-4 mr-2" />
            Cambiar conexión
          </button>

          {showServerConfig && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl space-y-3">
              <p className="text-sm text-slate-600 font-medium text-center">¿Cómo te conectas?</p>
              {(Object.keys(ENVIRONMENTS) as EnvironmentKey[]).map((key) => {
                const url = ENVIRONMENTS[key];
                const isSelected = apiUrl === url;
                const status = serverStatus[url];
                const isTesting = testingServer === url;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectServer(url)}
                    disabled={isTesting}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[#B8860B] bg-amber-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="text-left">
                      <span className={`text-base font-semibold ${isSelected ? 'text-[#B8860B]' : 'text-slate-700'}`}>
                        {ENVIRONMENT_LABELS[key]}
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">{ENVIRONMENT_DESCRIPTIONS[key]}</p>
                    </div>
                    <div className="flex items-center">
                      {isTesting ? (
                        <Loader2 className="w-5 h-5 text-[#B8860B] animate-spin" />
                      ) : isSelected && status === 'success' ? (
                        <Wifi className="w-5 h-5 text-green-600" />
                      ) : status === 'error' ? (
                        <WifiOff className="w-5 h-5 text-red-500" />
                      ) : isSelected ? (
                        <div className="w-3 h-3 rounded-full bg-[#B8860B]" />
                      ) : null}
                    </div>
                  </button>
                );
              })}
              {serverStatus[apiUrl] === 'success' && (
                <p className="text-sm text-green-600 text-center font-medium">
                  Conectado correctamente
                </p>
              )}
              {serverStatus[selectedServer] === 'error' && (
                <div className="mt-2 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600 text-center font-medium">
                    No hay conexión disponible
                  </p>
                  <p className="text-xs text-red-500 mt-1 text-center">
                    Verifica tu conexión e intenta de nuevo
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Sistema de Gestión de Uniformes v{SYSTEM_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
