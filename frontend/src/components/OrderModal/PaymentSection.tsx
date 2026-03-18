/**
 * PaymentSection - Advance payment input and calculation with cash change tracking
 */
import PaymentMethodSelector from '../PaymentMethodSelector';
import CashChangeTracker from '../CashChangeTracker';
import type { PaymentSectionProps } from './types';

export default function PaymentSection({
  total,
  advancePayment,
  advancePaymentMethod,
  advanceAmountReceived,
  onAdvancePaymentChange,
  onPaymentMethodChange,
  onAmountReceivedChange,
}: PaymentSectionProps) {
  const balance = total - advancePayment;

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <span className="text-gray-600">Subtotal:</span>
        <span className="font-medium">${total.toLocaleString()}</span>
      </div>

      {/* Advance Payment Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-600">Anticipo:</span>
          <span className="font-medium text-green-600">${advancePayment.toLocaleString()}</span>
        </div>

        {/* Quick Percentage Buttons */}
        <div className="flex gap-2 mb-2">
          {[0, 30, 50, 100].map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => onAdvancePaymentChange(Math.round(total * pct / 100))}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition ${
                advancePayment === Math.round(total * pct / 100)
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {pct === 0 ? 'Sin anticipo' : pct === 100 ? 'Pago total' : `${pct}%`}
            </button>
          ))}
        </div>

        {/* Custom Amount Input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Otro monto:</span>
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              max={total}
              value={advancePayment || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onAdvancePaymentChange(Math.min(Math.max(0, val), total));
              }}
              placeholder="0"
              className="w-full pl-6 pr-3 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Payment Method - only show when advance payment > 0 */}
        {advancePayment > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <PaymentMethodSelector
              value={advancePaymentMethod}
              onChange={(method) => onPaymentMethodChange(method as '' | 'cash' | 'nequi' | 'transfer' | 'card')}
              label="Metodo de Pago del Anticipo:"
              accentColor="blue"
              error={!advancePaymentMethod}
            />

            {/* Cash change tracking */}
            {advancePaymentMethod === 'cash' && (
              <CashChangeTracker
                amountDue={advancePayment}
                amountReceived={advanceAmountReceived}
                onAmountReceivedChange={onAmountReceivedChange}
              />
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <span className="text-gray-800 font-medium">Saldo Pendiente:</span>
        <span className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {balance > 0 ? `$${balance.toLocaleString()}` : 'Pagado'}
        </span>
      </div>
    </div>
  );
}
