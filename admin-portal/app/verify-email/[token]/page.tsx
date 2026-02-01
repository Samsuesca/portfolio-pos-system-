'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Mail, ArrowLeft } from 'lucide-react';
import apiClient from '@/lib/api';

type VerifyState = 'loading' | 'success' | 'error';

interface VerifyResponse {
  message: string;
  old_email: string;
  new_email: string;
}

export default function VerifyEmailPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = useState<VerifyState>('loading');
  const [message, setMessage] = useState('');
  const [emailData, setEmailData] = useState<{ old: string; new: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Token no proporcionado');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await apiClient.post<VerifyResponse>(`/auth/verify-email/${token}`);
        setState('success');
        setMessage(response.data.message);
        setEmailData({
          old: response.data.old_email,
          new: response.data.new_email,
        });
      } catch (err: any) {
        setState('error');
        const detail = err.response?.data?.detail;
        if (typeof detail === 'string') {
          setMessage(detail);
        } else {
          setMessage('Error al verificar el correo. El enlace puede ser invalido o haber expirado.');
        }
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${
            state === 'loading' ? 'bg-slate-700' :
            state === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`}>
            {state === 'loading' && <Loader2 className="w-8 h-8 text-white animate-spin" />}
            {state === 'success' && <CheckCircle className="w-8 h-8 text-white" />}
            {state === 'error' && <XCircle className="w-8 h-8 text-white" />}
          </div>
          <h1 className="text-2xl font-bold text-white font-display">
            Verificacion de Correo
          </h1>
          <p className="text-slate-400 mt-2">
            Uniformes Consuelo Rios
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {state === 'loading' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-brand-500 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Verificando tu correo electronico...</p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Correo Actualizado
              </h2>
              <p className="text-slate-600 mb-6">{message}</p>

              {emailData && (
                <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
                  <div className="text-sm text-slate-500 mb-1">Correo anterior:</div>
                  <div className="text-slate-700 font-medium mb-3">{emailData.old}</div>
                  <div className="text-sm text-slate-500 mb-1">Nuevo correo:</div>
                  <div className="text-emerald-600 font-medium">{emailData.new}</div>
                </div>
              )}

              <p className="text-sm text-slate-500 mb-6">
                Ya puedes iniciar sesion con tu nuevo correo electronico.
              </p>

              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-semibold"
              >
                Ir a Iniciar Sesion
              </button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-800 mb-2">
                Error de Verificacion
              </h2>
              <p className="text-slate-600 mb-6">{message}</p>

              <div className="space-y-3">
                <button
                  onClick={() => router.push('/login')}
                  className="w-full py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors font-semibold"
                >
                  Ir a Iniciar Sesion
                </button>
                <button
                  onClick={() => router.back()}
                  className="w-full py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Volver
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-8">
          © {new Date().getFullYear()} Uniformes Consuelo Rios
        </p>
      </div>
    </div>
  );
}
