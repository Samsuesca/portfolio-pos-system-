/**
 * Alteration Payment Modal - Record payment for an alteration
 */
import { useState, useEffect } from 'react';
import { X, Loader2, DollarSign, Banknote, CreditCard, Smartphone, Building2 } from 'lucide-react';
import { alterationService } from '../services/alterationService';
import type { AlterationWithPayments, AlterationPaymentCreate } from '../types/api';
import { formatCurrency } from '../utils/formatting';

interface AlterationPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  alteration: AlterationWithPayments | null;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Efectivo', icon: Banknote, color: 'text-green-600' },
  { value: 'nequi', label: 'Nequi', icon: Smartphone, color: 'text-purple-600' },
  { value: 'transfer', label: 'Transferencia', icon: Building2, color: 'text-blue-600' },
  { value: 'card', label: 'Tarjeta', icon: CreditCard, color: 'text-orange-600' },
] as const;

export default function AlterationPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  alteration
}: AlterationPaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    payment_method: '' as '' | 'cash' | 'nequi' | 'transfer' | 'card',
    notes: '',
    apply_accounting: true,
    amount_received: ''
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen && alteration) {
      setFormData({
        amount: String(alteration.balance),  // Default to full balance
        payment_method: 'cash',
        notes: '',
        apply_accounting: true,
        amount_received: ''
      });
      setError(null);
    }
  }, [isOpen, alteration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alteration) return;

    setError(null);

    // Validation
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Ingresa un monto válido');
      return;
    }
    if (amount > alteration.balance) {
      setError(`El monto no puede ser mayor al saldo pendiente (${formatCurrency(alteration.balance)})`);
      return;
    }
    if (!formData.payment_method) {
      setError('Selecciona un método de pago');
      return;
    }

    try {
      setLoading(true);

      const paymentData: AlterationPaymentCreate = {
        amount: amount,
        payment_method: formData.payment_method,
        notes: formData.notes || undefined,
        apply_accounting: formData.apply_accounting,
        ...(formData.payment_method === 'cash' && formData.amount_received
          ? { amount_received: parseFloat(formData.amount_received) }
          : {}),
      };

      await alterationService.recordPayment(alteration.id, paymentData);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      setError(err.response?.data?.detail || 'Error al registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  // Quick amount buttons
  const setQuickAmount = (percentage: number) => {
    if (!alteration) return;
    const amount = Math.round(alteration.balance * percentage);
    setFormData(prev => ({ ...prev, amount: String(amount) }));
  };

  if (!isOpen || !alteration) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Registrar Pago
                </h2>
                <p className="text-sm text-gray-500">
                  {alteration.code}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Balance Info */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Saldo Pendiente</span>
              <span className="text-xl font-semibold text-red-600">
                {formatCurrency(alteration.balance)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1 text-sm">
              <span className="text-gray-500">Total: {formatCurrency(alteration.cost)}</span>
              <span className="text-gray-500">Pagado: {formatCurrency(alteration.amount_paid)}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Pagar *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  min="0"
                  max={alteration.balance}
                  step="100"
                  className="w-full pl-8 pr-3 py-3 text-lg border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                />
              </div>
              {/* Quick amount buttons */}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.5)}
                  className="flex-1 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                  50%
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(0.75)}
                  className="flex-1 py-1.5 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                >
                  75%
                </button>
                <button
                  type="button"
                  onClick={() => setQuickAmount(1)}
                  className="flex-1 py-1.5 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                >
                  Total
                </button>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Método de Pago *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(method => {
                  const Icon = method.icon;
                  const isSelected = formData.payment_method === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setFormData(prev => ({
                        ...prev,
                        payment_method: method.value,
                        ...(method.value !== 'cash' ? { amount_received: '' } : {}),
                      }))}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-brand-600' : method.color}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-brand-700' : 'text-gray-700'}`}>
                        {method.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash change tracking - Only for cash payments */}
            {formData.payment_method === 'cash' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-amber-800 mb-1">
                      Monto Recibido del Cliente
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
                      <input
                        type="number"
                        value={formData.amount_received}
                        onChange={(e) => setFormData(prev => ({ ...prev, amount_received: e.target.value }))}
                        placeholder={formData.amount ? `Min: $${parseFloat(formData.amount).toLocaleString()}` : 'Opcional'}
                        className="w-full pl-9 pr-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Show calculated change */}
                  {formData.amount_received && formData.amount && parseFloat(formData.amount_received) >= parseFloat(formData.amount) && (
                    <div className="text-right min-w-[100px]">
                      <span className="text-xs text-amber-700">Devueltas:</span>
                      <p className="text-xl font-bold text-amber-800">
                        ${(parseFloat(formData.amount_received) - parseFloat(formData.amount)).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Error: insufficient amount */}
                {formData.amount_received && formData.amount && parseFloat(formData.amount_received) < parseFloat(formData.amount) && (
                  <p className="text-xs text-red-600 mt-2">
                    Monto insuficiente. Minimo: ${parseFloat(formData.amount).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Referencia, comentarios..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>

            {/* Apply Accounting Toggle */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="apply_accounting"
                checked={formData.apply_accounting}
                onChange={(e) => setFormData(prev => ({ ...prev, apply_accounting: e.target.checked }))}
                className="w-4 h-4 text-brand-600 rounded"
              />
              <label htmlFor="apply_accounting" className="text-sm text-gray-700 cursor-pointer">
                Registrar en contabilidad (actualiza saldos de caja)
              </label>
            </div>
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4" />
                  Registrar Pago
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
