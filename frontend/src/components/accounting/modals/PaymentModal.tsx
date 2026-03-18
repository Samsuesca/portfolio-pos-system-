/**
 * PaymentModal - Modal for paying receivables/payables
 */
import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatting';
import type { AccountsReceivableListItem, AccountsPayableListItem, AccPaymentMethod } from '../types';
import { PAYMENT_METHODS } from '../types';
import { getPaymentMethodLabel } from '../../../services/accountingService';

interface PaymentModalProps {
  isOpen: boolean;
  type: 'receivable' | 'payable';
  item: AccountsReceivableListItem | AccountsPayableListItem | null;
  paymentAmount: number;
  paymentMethod: AccPaymentMethod | '';
  onAmountChange: (amount: number) => void;
  onMethodChange: (method: AccPaymentMethod | '') => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting: boolean;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  type,
  item,
  paymentAmount,
  paymentMethod,
  onAmountChange,
  onMethodChange,
  onSubmit,
  onClose,
  submitting
}) => {
  if (!isOpen || !item) return null;

  const isReceivable = type === 'receivable';
  const bgColor = isReceivable ? 'bg-brand-50' : 'bg-red-50';
  const textColor = isReceivable ? 'text-brand-600' : 'text-red-600';
  const buttonColor = 'bg-green-600 hover:bg-green-700';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            Registrar {isReceivable ? 'Cobro' : 'Pago'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className={`${bgColor} rounded-lg p-4`}>
            <p className="text-sm text-gray-600">Cuenta por {isReceivable ? 'Cobrar' : 'Pagar'}:</p>
            <p className="font-medium">{item.description}</p>
            {'vendor' in item && item.vendor && (
              <p className="text-sm text-gray-500">Proveedor: {item.vendor}</p>
            )}
            {'client_name' in item && item.client_name && (
              <p className="text-sm text-gray-500">Cliente: {item.client_name}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">
              Pendiente: <span className={`font-medium ${textColor}`}>{formatCurrency(item.balance)}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto a {isReceivable ? 'cobrar' : 'pagar'}</label>
            <input
              type="number"
              value={paymentAmount}
              onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
              max={item.balance}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Metodo de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => onMethodChange(e.target.value as AccPaymentMethod)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent ${
                !paymentMethod ? 'border-red-300 text-gray-400' : 'border-gray-300'
              }`}
            >
              <option value="" disabled>-- Seleccione metodo --</option>
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>{getPaymentMethodLabel(method)}</option>
              ))}
            </select>
            {!paymentMethod && (
              <p className="text-xs text-red-500 mt-1">Debe seleccionar un metodo de pago</p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || paymentAmount <= 0 || paymentAmount > item.balance || !paymentMethod}
            className={`px-4 py-2 ${buttonColor} text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Registrar {isReceivable ? 'Cobro' : 'Pago'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
