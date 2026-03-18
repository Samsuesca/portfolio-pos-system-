/**
 * BalancePatrimony - Patrimony/Balance sheet display component
 * Redesigned with dark equation header and clean two-column layout
 */
import React from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, PiggyBank,
  Wallet, Landmark, Receipt, Users, Calculator, Clock,
  CreditCard, Car, Sparkles, Settings, Loader2
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
        <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        <span className="ml-3 text-stone-500">Cargando patrimonio...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl ring-1 ring-stone-200/60 overflow-hidden">
      {/* Dark Equation Header */}
      <div className="bg-stone-900 text-white p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-brand-400" />
            Balance Patrimonial
          </h3>
          <span className="text-xs text-stone-400">Activos - Pasivos = Patrimonio</span>
        </div>

        <div className="grid grid-cols-5 items-center gap-3">
          <div className="text-center col-span-1">
            <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider font-semibold">Activos</p>
            <p className="text-xl lg:text-2xl font-bold text-green-400 font-tabular tracking-tight">{formatCurrency(patrimony.assets.total)}</p>
          </div>
          <div className="text-center col-span-1">
            <span className="text-2xl font-bold text-stone-500">−</span>
          </div>
          <div className="text-center col-span-1">
            <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider font-semibold">Pasivos</p>
            <p className="text-xl lg:text-2xl font-bold text-red-400 font-tabular tracking-tight">{formatCurrency(patrimony.liabilities.total)}</p>
          </div>
          <div className="text-center col-span-1">
            <span className="text-2xl font-bold text-stone-500">=</span>
          </div>
          <div className="text-center col-span-1">
            <p className="text-[10px] text-stone-400 mb-1 uppercase tracking-wider font-semibold">Patrimonio</p>
            <p className="text-xl lg:text-2xl font-bold text-amber-400 font-tabular tracking-tight">{formatCurrency(patrimony.summary.net_patrimony)}</p>
          </div>
        </div>
      </div>

      {/* Two Column Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-stone-100">
        {/* Assets Column */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            </div>
            <h4 className="text-sm font-semibold text-stone-800">Activos</h4>
            <span className="text-lg font-bold text-green-600 font-tabular ml-auto">{formatCurrency(patrimony.assets.total)}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Caja</span>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.assets.cash_and_bank.caja)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Banco</span>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.assets.cash_and_bank.banco)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm font-semibold text-stone-700">Total Liquido</span>
              </div>
              <span className="text-sm font-bold text-brand-700 font-tabular">{formatCurrency(patrimony.assets.cash_and_bank.total_liquid)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Inventario <span className="text-xs text-stone-400">({patrimony.assets.inventory.total_units} uds)</span></span>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.assets.inventory.total_value)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Cuentas por Cobrar <span className="text-xs text-stone-400">({patrimony.assets.accounts_receivable.count})</span></span>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.assets.accounts_receivable.total)}</span>
            </div>
            <div className="flex items-center justify-between py-2 bg-green-50/60 rounded-lg px-3 mt-1">
              <div className="flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5 text-green-600" />
                <span className="text-sm font-semibold text-green-700">Activos Corrientes</span>
              </div>
              <span className="text-sm font-bold text-green-700 font-tabular">{formatCurrency(patrimony.assets.current_assets)}</span>
            </div>
            <div className="flex items-center justify-between py-2 group">
              <div className="flex items-center gap-2">
                <Car className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Activos Fijos</span>
                <button
                  onClick={() => onManageAssets('asset_fixed')}
                  className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                >
                  <Settings className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.assets.fixed_assets.total_value)}</span>
            </div>
            <div className="flex items-center justify-between py-2 group">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Activos Intangibles</span>
                <button
                  onClick={() => onManageAssets('asset_intangible')}
                  className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                >
                  <Settings className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.assets.intangible_assets?.total_value ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Liabilities Column */}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center">
              <TrendingDown className="w-3.5 h-3.5 text-red-600" />
            </div>
            <h4 className="text-sm font-semibold text-stone-800">Pasivos</h4>
            <span className="text-lg font-bold text-red-600 font-tabular ml-auto">{formatCurrency(patrimony.liabilities.total)}</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Cuentas por Pagar <span className="text-xs text-stone-400">({patrimony.liabilities.accounts_payable.count})</span></span>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.liabilities.accounts_payable.total)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Gastos Pendientes <span className="text-xs text-stone-400">({patrimony.liabilities.pending_expenses.count})</span></span>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.liabilities.pending_expenses.total)}</span>
            </div>
            <div className="flex items-center justify-between py-2 group">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Pasivos Corrientes</span>
                <button
                  onClick={() => onManageAssets('liability_current')}
                  className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                >
                  <Settings className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <span className="text-sm font-medium text-orange-600 font-tabular">{formatCurrency(patrimony.liabilities.debts.short_term)}</span>
            </div>
            <div className="flex items-center justify-between py-2 group">
              <div className="flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5 text-stone-400" />
                <span className="text-sm text-stone-600">Pasivos Largo Plazo</span>
                <button
                  onClick={() => onManageAssets('liability_long')}
                  className="text-[10px] font-semibold text-brand-500 hover:text-brand-700 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5"
                >
                  <Settings className="w-3 h-3" />
                  Gestionar
                </button>
              </div>
              <span className="text-sm font-medium text-stone-800 font-tabular">{formatCurrency(patrimony.liabilities.debts.long_term)}</span>
            </div>
            <div className="flex items-center justify-between py-2 bg-red-50/60 rounded-lg px-3 mt-1">
              <span className="text-sm font-semibold text-red-700">Total Pasivos</span>
              <span className="text-sm font-bold text-red-700 font-tabular">{formatCurrency(patrimony.liabilities.total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalancePatrimony;
