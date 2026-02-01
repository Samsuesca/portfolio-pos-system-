/**
 * Drawer Access Modal - Request and validate access code for cash drawer
 */
import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Lock, Mail, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { cashDrawerService } from '../services/cashDrawerService';
import { openCashDrawer } from '../services/thermalPrinterService';
import { usePrinterStore } from '../stores/printerStore';

interface DrawerAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalState = 'initial' | 'requesting' | 'code_sent' | 'validating' | 'success' | 'error';

export default function DrawerAccessModal({ isOpen, onClose, onSuccess }: DrawerAccessModalProps) {
  const { settings } = usePrinterStore();
  const [state, setState] = useState<ModalState>('initial');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer for countdown
  useEffect(() => {
    if (expiresAt && state === 'code_sent') {
      const interval = setInterval(() => {
        const now = new Date();
        const diff = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setTimeLeft(diff);

        if (diff <= 0) {
          clearInterval(interval);
          setState('error');
          setError('El codigo ha expirado. Solicita uno nuevo.');
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [expiresAt, state]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setState('initial');
      setError(null);
      setCode(['', '', '', '', '', '']);
      setExpiresAt(null);
      setTimeLeft(0);
    }
  }, [isOpen]);

  const handleRequestCode = async () => {
    setState('requesting');
    setError(null);

    try {
      const response = await cashDrawerService.requestAccess();
      setExpiresAt(new Date(response.expires_at));
      setTimeLeft(response.expires_in);
      setState('code_sent');
      // Focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setState('error');
      setError(err.response?.data?.detail || 'Error al solicitar el codigo');
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (digit && index === 5 && newCode.every(c => c)) {
      handleValidateCode(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleValidateCode = async (fullCode: string) => {
    setState('validating');
    setError(null);

    try {
      await cashDrawerService.validateAccess(fullCode);

      // Now open the drawer via Tauri
      if (settings.portName) {
        await openCashDrawer(settings.portName);
      }

      setState('success');
      onSuccess?.();

      // Close after a delay
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setState('code_sent');
      setError(err.response?.data?.detail || 'Codigo invalido');
      // Clear code and focus first input
      setCode(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center">
            <Lock className="w-5 h-5 text-amber-600 mr-2" />
            <h3 className="text-lg font-semibold">Solicitar Apertura de Cajon</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Initial State */}
          {state === 'initial' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
                <Mail className="w-8 h-8 text-amber-600" />
              </div>
              <p className="text-gray-600 mb-6">
                Se enviara un codigo de 6 digitos al administrador para autorizar la apertura del cajon.
              </p>
              <button
                onClick={handleRequestCode}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-medium"
              >
                Solicitar Codigo
              </button>
            </div>
          )}

          {/* Requesting State */}
          {state === 'requesting' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 mx-auto text-amber-600 animate-spin mb-4" />
              <p className="text-gray-600">Enviando codigo al administrador...</p>
            </div>
          )}

          {/* Code Sent State */}
          {state === 'code_sent' && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-amber-600" />
                <span className={`text-lg font-mono font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-800'}`}>
                  {formatTime(timeLeft)}
                </span>
              </div>

              <p className="text-gray-600 mb-6">
                Ingresa el codigo de 6 digitos que recibio el administrador
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Code Input */}
              <div className="flex justify-center gap-2 mb-6">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleCodeChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition"
                  />
                ))}
              </div>

              <button
                onClick={handleRequestCode}
                className="text-sm text-amber-600 hover:text-amber-700 underline"
              >
                Reenviar codigo
              </button>
            </div>
          )}

          {/* Validating State */}
          {state === 'validating' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 mx-auto text-amber-600 animate-spin mb-4" />
              <p className="text-gray-600">Verificando codigo...</p>
            </div>
          )}

          {/* Success State */}
          {state === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Cajon Abierto</h3>
              <p className="text-gray-600">El cajon se ha abierto exitosamente</p>
            </div>
          )}

          {/* Error State (expired) */}
          {state === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <p className="text-red-600 mb-6">{error}</p>
              <button
                onClick={handleRequestCode}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition font-medium"
              >
                Solicitar Nuevo Codigo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
