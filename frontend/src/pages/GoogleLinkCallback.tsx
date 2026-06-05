import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../utils/api-client';
import { useAuthStore } from '../stores/authStore';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

export default function GoogleLinkCallback() {
  const navigate = useNavigate();
  const { getCurrentUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');

    if (!idToken) {
      setError('No se recibio token de Google. Intenta de nuevo.');
      return;
    }

    apiClient
      .post('/auth/link-google', { id_token: idToken })
      .then(() => {
        setSuccess(true);
        getCurrentUser();
        setTimeout(() => navigate('/settings', { replace: true }), 1500);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Error al vincular cuenta de Google.');
      });
  }, []);

  if (success) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-surface-200 w-full max-w-sm p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-slate-700">Cuenta de Google vinculada exitosamente</p>
          <p className="text-slate-400 text-sm mt-2">Redirigiendo a configuracion...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-surface-200 w-full max-w-sm p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-700 mb-4">{error}</p>
          <button
            onClick={() => navigate('/settings', { replace: true })}
            className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            Volver a configuracion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto mb-3" />
        <p className="text-slate-500">Vinculando cuenta de Google...</p>
      </div>
    </div>
  );
}
