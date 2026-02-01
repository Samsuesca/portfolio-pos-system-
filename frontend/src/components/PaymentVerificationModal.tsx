/**
 * Payment Verification Modal
 *
 * Admin modal to view payment proofs uploaded by customers
 * and approve or reject payments for orders.
 */
import { useState } from 'react';
import { X, XCircle, Image as ImageIcon, FileText, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatting';

interface PaymentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: {
    id: string;
    code: string;
    client_name: string;
    total_amount: number;
    payment_proof_url?: string | null;
    payment_notes?: string | null;
    status: string;
  };
  onApprove: (orderId: string) => Promise<void>;
  onReject: (orderId: string, notes: string) => Promise<void>;
}

export default function PaymentVerificationModal({
  isOpen,
  onClose,
  order,
  onApprove,
  onReject
}: PaymentVerificationModalProps) {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!isOpen) return null;

  const handleApprove = async () => {
    if (!confirm('¿Aprobar el pago de este pedido?')) {
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      await onApprove(order.id);
      onClose();
    } catch (err: any) {
      console.error('Error approving payment:', err);
      setError(err.response?.data?.detail || 'Error al aprobar pago');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNotes.trim()) {
      setError('Debes proporcionar un motivo de rechazo');
      return;
    }

    if (!confirm('¿Rechazar el comprobante de pago?')) {
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      await onReject(order.id, rejectionNotes);
      onClose();
    } catch (err: any) {
      console.error('Error rejecting payment:', err);
      setError(err.response?.data?.detail || 'Error al rechazar pago');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Verificar Comprobante de Pago</h2>
            <p className="text-blue-100 text-sm">Pedido #{order.code}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-blue-800 rounded-lg p-2 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Order Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Cliente</p>
                <p className="font-semibold text-gray-900">{order.client_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Monto Total</p>
                <p className="font-semibold text-gray-900 text-lg text-green-600">
                  {formatCurrency(order.total_amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Payment Proof */}
          {order.payment_proof_url ? (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                Comprobante de Pago
              </h3>
              <div className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <img
                  src={order.payment_proof_url}
                  alt="Comprobante de pago"
                  className="w-full max-h-96 object-contain bg-gray-100"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const container = e.currentTarget.parentElement;
                    if (container) {
                      container.innerHTML = `
                        <div class="flex flex-col items-center justify-center p-12 bg-gray-50">
                          <p class="text-gray-500">No se pudo cargar la imagen</p>
                          <a href="${order.payment_proof_url}" target="_blank" class="text-blue-600 hover:underline mt-2">
                            Abrir en nueva pestaña
                          </a>
                        </div>
                      `;
                    }
                  }}
                />
              </div>
              <a
                href={order.payment_proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
              >
                Abrir imagen en tamaño completo →
              </a>
            </div>
          ) : (
            <div className="mb-6 text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <FileText className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p className="text-gray-500">No hay comprobante adjunto</p>
            </div>
          )}

          {/* Payment Notes */}
          {order.payment_notes && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">Notas del Cliente</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-gray-700">{order.payment_notes}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Rejection Form */}
          {showRejectForm && (
            <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-3">Motivo del Rechazo</h3>
              <textarea
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                rows={4}
                placeholder="Explica por qué se rechaza el comprobante..."
                className="w-full px-3 py-2 border border-red-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleReject}
                  disabled={processing || !rejectionNotes.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rechazando...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Confirmar Rechazo
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionNotes('');
                    setError(null);
                  }}
                  disabled={processing}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showRejectForm && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={processing}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium transition"
            >
              Cerrar
            </button>

            {order.payment_proof_url && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle className="w-4 h-4" />
                  Rechazar
                </button>

                <button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Aprobar Pago
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
