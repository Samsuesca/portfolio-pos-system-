/**
 * EditBalanceModal - Modal for editing cash account balances
 */
import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatting';
import type { CashBalancesResponse } from '../types';

type AccountKey = 'caja_menor' | 'caja_mayor' | 'nequi' | 'banco';

interface EditBalanceModalProps {
  isOpen: boolean;
  editingAccount: AccountKey | null;
  cashBalances: CashBalancesResponse | null;
  newBalanceValue: number;
  onBalanceChange: (value: number) => void;
  onSave: () => void;
  onClose: () => void;
  submitting: boolean;
}

const getAccountLabel = (account: AccountKey): string => {
  const labels: Record<string, string> = {
    caja_menor: 'Caja Menor',
    caja_mayor: 'Caja Mayor',
    nequi: 'Nequi',
    banco: 'Banco'
  };
  return labels[account] || account;
};

const EditBalanceModal: React.FC<EditBalanceModalProps> = ({
  isOpen,
  editingAccount,
  cashBalances,
  newBalanceValue,
  onBalanceChange,
  onSave,
  onClose,
  submitting
}) => {
  if (!isOpen || !editingAccount) return null;

  const getCurrentBalance = (): number => {
    switch (editingAccount) {
      case 'caja_menor':
        return cashBalances?.caja_menor?.balance || 0;
      case 'caja_mayor':
        return cashBalances?.caja_mayor?.balance || 0;
      case 'nequi':
        return cashBalances?.nequi?.balance || 0;
      case 'banco':
        return cashBalances?.banco?.balance || 0;
      default:
        return 0;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">
            Editar Balance de {getAccountLabel(editingAccount)}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Balance Actual
            </label>
            <p className="text-lg font-semibold text-gray-800">
              {formatCurrency(getCurrentBalance())}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nuevo Balance
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={newBalanceValue === 0 ? '' : newBalanceValue}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                onBalanceChange(val === '' ? 0 : parseFloat(val));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              placeholder="Ingrese el nuevo balance"
            />
          </div>
          <p className="text-sm text-gray-500">
            Este ajuste quedara registrado en el historial de la cuenta.
          </p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onSave}
            disabled={submitting}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditBalanceModal;
