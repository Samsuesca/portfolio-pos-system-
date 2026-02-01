/**
 * Email Verification Page
 * Handles email change verification tokens
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, ArrowLeft } from 'lucide-react';
import { userService } from '../services/userService';

type VerificationStatus = 'loading' | 'success' | 'error';

export default function VerifyEmail() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<VerificationStatus>('loading');
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (token) {
      verifyToken(token);
    } else {
      setStatus('error');
      setMessage('Token no proporcionado');
    }
  }, [token]);

  const verifyToken = async (verificationToken: string) => {
    try {
      const result = await userService.verifyEmailChange(verificationToken);
      setStatus('success');
      setMessage(result.message);
      setNewEmail(result.new_email);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.response?.data?.detail || 'Error al verificar el correo');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <Mail className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Verificacion de Correo</h1>
        </div>

        {/* Status Content */}
        <div className="text-center">
          {status === 'loading' && (
            <div className="py-8">
              <Loader2 className="w-12 h-12 mx-auto text-amber-600 animate-spin mb-4" />
              <p className="text-gray-600">Verificando tu correo electronico...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Correo Verificado</h2>
              <p className="text-gray-600 mb-2">{message}</p>
              {newEmail && (
                <p className="text-sm text-gray-500">
                  Tu nuevo correo es: <span className="font-medium text-gray-700">{newEmail}</span>
                </p>
              )}
              <button
                onClick={() => navigate('/login')}
                className="mt-6 px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center mx-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Ir al Inicio de Sesion
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Error de Verificacion</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <p className="text-sm text-gray-500 mb-6">
                El enlace puede haber expirado o ya fue utilizado.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition flex items-center mx-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al Inicio
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            Uniformes Consuelo Rios - Sistema de Gestion
          </p>
        </div>
      </div>
    </div>
  );
}
