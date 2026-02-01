/**
 * AddPaymentModal - Modal para agregar pagos a ventas existentes
 *
 * Permite agregar pagos parciales o completar el saldo de una venta
 * que fue creada sin método de pago o tiene saldo pendiente.
 */
import { useState } from 'react';
import { X, DollarSign, CreditCard, Loader2 } from 'lucide-react';
import { saleService, type PaymentMethod } from '../services/saleService';
import { extractErrorMessage } from '../utils/api-client';
import CurrencyInput from './CurrencyInput';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  saleId: string;
  schoolId: string;
  saleCode: string;
  pendingAmount: number;
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'credit', label: 'Crédito' },
];

export default function AddPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  saleId,
  schoolId,
  saleCode,
  pendingAmount,
}: AddPaymentModalProps) {
  const [amount, setAmount] = useState<number>(pendingAmount);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [applyAccounting, setApplyAccounting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amount <= 0) {
      setError('El monto debe ser mayor a 0');
      return;
    }

    if (amount > pendingAmount) {
      setError(`El monto no puede ser mayor al saldo pendiente ($${pendingAmount.toLocaleString()})`);
      return;
    }

    setLoading(true);

    try {
      await saleService.addPaymentToSale(schoolId, saleId, {
        amount,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
        apply_accounting: applyAccounting,
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFillPending = () => {
    setAmount(pendingAmount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Agregar Pago</h2>
              <p className="text-sm text-gray-500">Venta {saleCode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Saldo pendiente */}
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-amber-800">Saldo pendiente:</span>
            <span className="text-lg font-semibold text-amber-900">
              ${pendingAmount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monto del pago
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <CurrencyInput
                  value={amount}
                  onChange={setAmount}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={handleFillPending}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                title="Llenar con saldo pendiente"
              >
                Todo
              </button>
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Método de pago
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                    paymentMethod === method.value
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Ej: Pago parcial, referencia de transferencia..."
            />
          </div>

          {/* Aplicar contabilidad */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="applyAccounting"
              checked={applyAccounting}
              onChange={(e) => setApplyAccounting(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="applyAccounting" className="text-sm text-gray-700">
              Registrar en contabilidad
            </label>
          </div>

          {/* Info about credit */}
          {paymentMethod === 'credit' && (
            <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
              <CreditCard className="w-4 h-4 inline mr-1" />
              El pago a crédito generará una cuenta por cobrar.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || amount <= 0}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Agregar Pago
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
