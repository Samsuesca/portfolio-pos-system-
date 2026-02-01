'use client';

/**
 * PaymentSection - Advance payment input and calculation with cash change tracking
 */
import { DollarSign } from 'lucide-react';
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
  const changeGiven = advanceAmountReceived && advanceAmountReceived >= advancePayment
    ? advanceAmountReceived - advancePayment
    : 0;

  return (
    <div className="bg-slate-50 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <span className="text-slate-600">Subtotal:</span>
        <span className="font-medium">${total.toLocaleString()}</span>
      </div>

      {/* Advance Payment Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-600">Anticipo:</span>
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
                  ? 'bg-brand-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {pct === 0 ? 'Sin anticipo' : pct === 100 ? 'Pago total' : `${pct}%`}
            </button>
          ))}
        </div>

        {/* Custom Amount Input */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Otro monto:</span>
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
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
              className="w-full pl-6 pr-3 py-1.5 border border-slate-300 rounded text-sm text-right focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Payment Method - only show when advance payment > 0 */}
        {advancePayment > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <label className="block text-xs text-slate-600 mb-2">Metodo de Pago del Anticipo:</label>
            <select
              value={advancePaymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value as '' | 'cash' | 'nequi' | 'transfer' | 'card')}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none ${
                !advancePaymentMethod ? 'border-red-300 text-slate-400' : 'border-slate-300'
              }`}
            >
              <option value="" disabled>-- Seleccione metodo --</option>
              <option value="cash">Efectivo</option>
              <option value="nequi">Nequi</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
            </select>
            {!advancePaymentMethod && (
              <p className="text-xs text-red-500 mt-1">Debe seleccionar un metodo de pago</p>
            )}

            {/* Cash change tracking - Only for cash payments */}
            {advancePaymentMethod === 'cash' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-amber-800 mb-1">
                      Monto Recibido del Cliente
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-600" />
                      <input
                        type="number"
                        value={advanceAmountReceived || ''}
                        onChange={(e) => onAmountReceivedChange(Number(e.target.value) || 0)}
                        placeholder={`Min: $${advancePayment.toLocaleString()}`}
                        className="w-full pl-9 pr-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Show calculated change */}
                  {advanceAmountReceived > 0 && advanceAmountReceived >= advancePayment && (
                    <div className="text-right min-w-[100px]">
                      <span className="text-xs text-amber-700">Devueltas:</span>
                      <p className="text-xl font-bold text-amber-800">
                        ${changeGiven.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Error: insufficient amount */}
                {advanceAmountReceived > 0 && advanceAmountReceived < advancePayment && (
                  <p className="text-xs text-red-600 mt-2">
                    Monto insuficiente. Minimo: ${advancePayment.toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-3 border-t border-slate-200">
        <span className="text-slate-800 font-medium">Saldo Pendiente:</span>
        <span className={`text-lg font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {balance > 0 ? `$${balance.toLocaleString()}` : 'Pagado'}
        </span>
      </div>
    </div>
  );
}
