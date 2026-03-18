/**
 * Payments Section
 * Multiple payments support with cash change tracking
 */
import { CreditCard, Plus, Trash2, DollarSign } from 'lucide-react';
import PaymentMethodSelector from '../PaymentMethodSelector';
import CashChangeTracker from '../CashChangeTracker';
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
              <PaymentMethodSelector
                value={payment.payment_method}
                onChange={(method) => onUpdateMethod(payment.id, method as PaymentLine['payment_method'])}
                includeCredit={true}
                accentColor="green"
                className="flex-1"
              />

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

            {/* Cash change tracking */}
            {payment.payment_method === 'cash' && (
              <CashChangeTracker
                amountDue={payment.amount}
                amountReceived={payment.amount_received}
                onAmountReceivedChange={(val) => onUpdateAmountReceived(payment.id, val)}
              />
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
