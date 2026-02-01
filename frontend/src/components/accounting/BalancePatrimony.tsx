/**
 * BalancePatrimony - Patrimony/Balance sheet display component
 */
import React from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, PiggyBank,
  Wallet, Landmark, Receipt, Users, Calculator, Clock,
  CreditCard, Car, Settings, Loader2
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type { GlobalPatrimonySummary, BalanceAccountModalType } from './types';

interface BalancePatrimonyProps {
  patrimony: GlobalPatrimonySummary | null;
  onManageAssets: (type: BalanceAccountModalType) => void;
}

const BalancePatrimony: React.FC<BalancePatrimonyProps> = ({
  patrimony,
  onManageAssets
}) => {
  if (!patrimony) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Cargando patrimonio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">Patrimonio Neto</p>
            <p className="text-4xl font-bold mt-1">{formatCurrency(patrimony.summary.net_patrimony)}</p>
            <p className="text-blue-100 text-sm mt-2">
              Activos - Pasivos = Patrimonio
            </p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <PiggyBank className="w-8 h-8" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Activos</h3>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(patrimony.assets.total)}</p>
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Caja</span>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.assets.cash_and_bank.caja)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Banco</span>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.assets.cash_and_bank.banco)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Total Liquido</span>
              </div>
              <span className="font-medium text-blue-600">{formatCurrency(patrimony.assets.cash_and_bank.total_liquid)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Inventario ({patrimony.assets.inventory.total_units} uds)</span>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.assets.inventory.total_value)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Cuentas por Cobrar ({patrimony.assets.accounts_receivable.count})</span>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.assets.accounts_receivable.total)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-blue-50 -mx-2 px-2 rounded">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span className="text-blue-700 font-medium">Activos Corrientes</span>
              </div>
              <span className="font-bold text-blue-700">{formatCurrency(patrimony.assets.current_assets)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 group">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Activos Fijos</span>
                <button
                  onClick={() => onManageAssets('asset_fixed')}
                  className="text-xs text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.assets.fixed_assets.total_value)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Pasivos</h3>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(patrimony.liabilities.total)}</p>
            </div>
          </div>
          <div className="space-y-3 border-t pt-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Cuentas por Pagar ({patrimony.liabilities.accounts_payable.count})</span>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.liabilities.accounts_payable.total)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Gastos Pendientes ({patrimony.liabilities.pending_expenses.count})</span>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.liabilities.pending_expenses.total)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 group">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Pasivos Corrientes</span>
                <button
                  onClick={() => onManageAssets('liability_current')}
                  className="text-xs text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <span className="font-medium text-orange-600">{formatCurrency(patrimony.liabilities.debts.short_term)}</span>
            </div>
            <div className="flex justify-between items-center py-2 group">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">Pasivos Largo Plazo</span>
                <button
                  onClick={() => onManageAssets('liability_long')}
                  className="text-xs text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <span className="font-medium text-gray-800">{formatCurrency(patrimony.liabilities.debts.long_term)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Equation Card */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <h4 className="text-sm font-medium text-gray-500 mb-4">Ecuacion Patrimonial</h4>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-sm text-gray-500">Activos</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(patrimony.assets.total)}</p>
          </div>
          <span className="text-2xl text-gray-400">-</span>
          <div className="text-center">
            <p className="text-sm text-gray-500">Pasivos</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(patrimony.liabilities.total)}</p>
          </div>
          <span className="text-2xl text-gray-400">=</span>
          <div className="text-center">
            <p className="text-sm text-gray-500">Patrimonio</p>
            <p className="text-xl font-bold text-blue-600">{formatCurrency(patrimony.summary.net_patrimony)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalancePatrimony;
