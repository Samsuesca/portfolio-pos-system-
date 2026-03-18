/**
 * Change Email Modal
 * Requests an email change with verification link.
 */
import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Mail, Loader2 } from 'lucide-react';
import { userService } from '../../services/userService';
import { useAuthStore } from '../../stores/authStore';

interface ChangeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();

  const [emailForm, setEmailForm] = useState({ new_email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmailForm({ new_email: '' });
      setError(null);
      setEmailSent(false);
    }
  }, [isOpen]);

  const handleRequestEmailChange = async () => {
    setLoading(true);
    setError(null);
    setEmailSent(false);

    if (!emailForm.new_email) {
      setError('Ingresa el nuevo correo electronico');
      setLoading(false);
      return;
    }

    if (emailForm.new_email.toLowerCase() === user?.email?.toLowerCase()) {
      setError('El nuevo correo es igual al actual');
      setLoading(false);
      return;
    }

    try {
      await userService.requestEmailChange(emailForm.new_email);
      setEmailSent(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al solicitar cambio de correo');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Cambiar Correo Electronico</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
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
          {emailSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Correo de verificacion enviado</h4>
              <p className="text-sm text-gray-600 mb-4">
                Hemos enviado un enlace de verificacion a:
              </p>
              <p className="font-medium text-gray-900 mb-4">{emailForm.new_email}</p>
              <p className="text-xs text-gray-500">
                Revisa tu bandeja de entrada (y spam) y haz clic en el enlace para confirmar tu nuevo correo.
                El enlace expira en 24 horas.
              </p>
            </div>
          ) : (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                <div className="flex items-start">
                  <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Verificacion requerida</p>
                    <p className="mt-1">Se enviara un enlace de verificacion al nuevo correo. Debes hacer clic en el enlace para completar el cambio.</p>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo actual</label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo correo electronico</label>
                <input
                  type="email"
                  value={emailForm.new_email}
                  onChange={(e) => setEmailForm({ new_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder="nuevo@email.com"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800 transition">
            {emailSent ? 'Cerrar' : 'Cancelar'}
          </button>
          {!emailSent && (
            <button
              onClick={handleRequestEmailChange}
              disabled={loading || !emailForm.new_email}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
              Enviar Verificacion
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ChangeEmailModal);
