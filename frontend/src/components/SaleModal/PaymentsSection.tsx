/**
 * Payments Section
 * Multiple payments support with cash change tracking
 */
import { CreditCard, Plus, Trash2, DollarSign } from 'lucide-react';
import type { PaymentLine } from './types';

interface PaymentsSectionProps {
  payments: PaymentLine[];
  totalAmount: number;
  onAddPayment: () => void;
  onRemovePayment: (id: string) => void;
  onUpdateAmount: (id: string, amount: number) => void;
  onUpdateMethod: (id: string, method: PaymentLine['payment_method']) => void;
  onUpdateAmountReceived: (id: string, value: number) => void;
}

export default function PaymentsSection({
  payments,
  totalAmount,
  onAddPayment,
  onRemovePayment,
  onUpdateAmount,
  onUpdateMethod,
  onUpdateAmountReceived,
}: PaymentsSectionProps) {
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="mt-6 border border-green-200 rounded-lg p-4 bg-green-50">
      <div className="flex items-center justify-between mb-3">
        <label className="text-sm font-semibold text-gray-800 flex items-center">
          <CreditCard className="w-4 h-4 mr-2 text-green-600" />
          Método de Pago
        </label>
        <button
          type="button"
          onClick={onAddPayment}
          className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Dividir pago
        </button>
      </div>

      <div className="space-y-3">
        {payments.map((payment) => (
          <div key={payment.id}>
            <div className="flex items-center gap-3">
              {/* Payment Method */}
              <select
                value={payment.payment_method}
                onChange={(e) => onUpdateMethod(payment.id, e.target.value as PaymentLine['payment_method'])}
                className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white ${
                  !payment.payment_method ? 'border-red-300 text-gray-400' : 'border-gray-300'
                }`}
              >
                <option value="" disabled>-- Seleccione método --</option>
                <option value="cash">Efectivo</option>
                <option value="nequi">Nequi</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="credit">Crédito</option>
              </select>

              {/* Amount - Only editable when multiple payments */}
              {payments.length > 1 && (
                <div className="relative w-32">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={payment.amount || ''}
                    onChange={(e) => onUpdateAmount(payment.id, Number(e.target.value) || 0)}
                    placeholder="Monto"
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                </div>
              )}

              {/* Remove button */}
              {payments.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemovePayment(payment.id)}
                  className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Cash change tracking - Only for cash payments */}
            {payment.payment_method === 'cash' && (
              <div className="ml-0 mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-amber-800 mb-1">
                      Monto Recibido del Cliente
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
                      <input
                        type="number"
                        value={payment.amount_received || ''}
                        onChange={(e) => onUpdateAmountReceived(payment.id, Number(e.target.value) || 0)}
                        placeholder={`Mín: $${payment.amount.toLocaleString()}`}
                        className="w-full pl-9 pr-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Show calculated change */}
                  {payment.amount_received && payment.amount_received >= payment.amount && (
                    <div className="text-right min-w-[100px]">
                      <span className="text-xs text-amber-700">Devueltas:</span>
                      <p className="text-xl font-bold text-amber-800">
                        ${(payment.amount_received - payment.amount).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Error: insufficient amount */}
                {payment.amount_received && payment.amount_received < payment.amount && (
                  <p className="text-xs text-red-600 mt-2">
                    Monto insuficiente. Mínimo: ${payment.amount.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Validation message for missing payment method */}
      {payments.some(p => !p.payment_method) && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            Debe seleccionar un método de pago
          </p>
        </div>
      )}

      {/* Validation message for split payments */}
      {payments.length > 1 && totalPayments !== totalAmount && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">
            La suma de pagos (${totalPayments.toLocaleString()}) no coincide con el total (${totalAmount.toLocaleString()})
          </p>
        </div>
      )}

      {/* Summary for split payments */}
      {payments.length > 1 && (
        <div className="mt-3 pt-3 border-t border-green-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Suma de pagos:</span>
            <span className={`font-medium ${totalPayments === totalAmount ? 'text-green-600' : 'text-orange-600'}`}>
              ${totalPayments.toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
