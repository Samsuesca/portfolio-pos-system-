/**
 * Cancel Confirmation Modal
 * Reusable modal for confirming cancellation of sales and orders
 * Shows warnings about rollback effects before confirming
 */
import { useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';

interface CancelConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  title: string;           // "Cancelar Venta" or "Cancelar Encargo"
  entityCode: string;      // VNT-2025-0001 or ENC-2025-0001
  warnings: string[];      // List of warnings about what will happen
  requireReason?: boolean; // Default true
  loading?: boolean;       // External loading state
}

export default function CancelConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityCode,
  warnings,
  requireReason = true,
  loading: externalLoading = false,
}: CancelConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);

  const loading = externalLoading || internalLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (requireReason && reason.trim().length < 5) {
      setError('La razón debe tener al menos 5 caracteres');
      return;
    }

    setInternalLoading(true);
    try {
      await onConfirm(reason.trim());
      // Reset form on success
      setReason('');
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error al cancelar');
    } finally {
      setInternalLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReason('');
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="text-gray-400 hover:text-gray-600 transition disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            {/* Entity Code */}
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Código: <span className="font-mono font-semibold">{entityCode}</span>
              </p>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm font-medium text-yellow-800 mb-2">
                  Esta acción realizará los siguientes cambios:
                </p>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {warnings.map((warning, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Reason Field */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Razón de cancelación {requireReason && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Escriba la razón de la cancelación..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={3}
                disabled={loading}
                required={requireReason}
                minLength={5}
              />
              <p className="text-xs text-gray-500 mt-1">
                Mínimo 5 caracteres
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={loading || (requireReason && reason.trim().length < 5)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  'Confirmar Cancelación'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
