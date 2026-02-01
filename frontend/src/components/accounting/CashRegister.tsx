/**
 * CashRegister - Daily flow/cash register closing component
 */
import React, { useState } from 'react';
import {
  Receipt, Wallet, DollarSign, CreditCard, Landmark,
  Calculator, ArrowUpRight, ArrowDownRight, Loader2,
  ChevronDown, ChevronUp, ShoppingBag, Package, Wrench, RefreshCw, ArrowLeftRight, FileText, HelpCircle
} from 'lucide-react';
import { formatCurrency, getColombiaDateString } from '../../utils/formatting';
import type { DailyFlowResponse } from './types';
import type { CategoryBreakdown } from '../../services/globalAccountingService';

interface CashRegisterProps {
  dailyFlow: DailyFlowResponse | null;
  dailyFlowDate: string;
  onDateChange: (date: string) => void;
  loading: boolean;
}

// Helper function to format date nicely
const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Helper function to get account icon and color
const getAccountStyle = (code: string) => {
  switch (code) {
    case '1101':
      return { icon: Wallet, color: 'bg-emerald-100 text-emerald-600', borderColor: 'border-emerald-200' };
    case '1102':
      return { icon: DollarSign, color: 'bg-blue-100 text-blue-600', borderColor: 'border-blue-200' };
    case '1103':
      return { icon: CreditCard, color: 'bg-purple-100 text-purple-600', borderColor: 'border-purple-200' };
    case '1104':
      return { icon: Landmark, color: 'bg-amber-100 text-amber-600', borderColor: 'border-amber-200' };
    default:
      return { icon: Wallet, color: 'bg-gray-100 text-gray-600', borderColor: 'border-gray-200' };
  }
};

// Category labels and icons for breakdown display
const CATEGORY_CONFIG: Record<keyof CategoryBreakdown, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  sales: { label: 'Ventas', icon: ShoppingBag, color: 'text-emerald-600' },
  orders: { label: 'Encargos', icon: Package, color: 'text-blue-600' },
  alterations: { label: 'Arreglos', icon: Wrench, color: 'text-purple-600' },
  sale_changes: { label: 'Cambios', icon: RefreshCw, color: 'text-amber-600' },
  transfers: { label: 'Transferencias', icon: ArrowLeftRight, color: 'text-cyan-600' },
  expenses: { label: 'Gastos', icon: FileText, color: 'text-red-600' },
  other: { label: 'Otros', icon: HelpCircle, color: 'text-gray-600' },
};

// Helper to check if breakdown has any data
const hasBreakdownData = (breakdown?: CategoryBreakdown): boolean => {
  if (!breakdown) return false;
  return Object.values(breakdown).some(cat => cat.count > 0);
};

const CashRegister: React.FC<CashRegisterProps> = ({
  dailyFlow,
  dailyFlowDate,
  onDateChange,
  loading
}) => {
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());

  const toggleExpand = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  return (
    <>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg p-6 text-white mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="w-7 h-7" />
              Cierre de Caja
            </h2>
            <p className="text-emerald-100 text-sm mt-1">
              Flujo de efectivo por cuenta - {dailyFlow ? formatDateLabel(dailyFlow.date) : 'Cargando...'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={dailyFlowDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:ring-2 focus:ring-white/50 focus:outline-none"
            />
            <button
              onClick={() => onDateChange(getColombiaDateString())}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
            >
              Hoy
            </button>
          </div>
        </div>
      </div>

      {loading || !dailyFlow ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <span className="ml-3 text-gray-600">Cargando flujo de caja...</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Account Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyFlow.accounts.map((account) => {
              const style = getAccountStyle(account.account_code);
              const Icon = style.icon;
              return (
                <div
                  key={account.account_id}
                  className={`bg-white rounded-xl shadow-sm border-2 ${style.borderColor} p-5`}
                >
                  {/* Account Header */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                    <div className={`w-10 h-10 ${style.color} rounded-full flex items-center justify-center`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{account.account_name}</h3>
                      <p className="text-xs text-gray-500">Codigo: {account.account_code}</p>
                    </div>
                  </div>

                  {/* Flow Details */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-gray-500 text-sm">Saldo Inicial</span>
                      <span className="font-medium text-gray-700">{formatCurrency(account.opening_balance)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-green-600 text-sm flex items-center gap-1">
                        <ArrowUpRight className="w-4 h-4" />
                        Entradas
                        {account.income_count > 0 && (
                          <span className="text-xs text-gray-400">({account.income_count})</span>
                        )}
                      </span>
                      <span className="font-medium text-green-600">+{formatCurrency(account.total_income)}</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-red-600 text-sm flex items-center gap-1">
                        <ArrowDownRight className="w-4 h-4" />
                        Salidas
                        {account.expense_count > 0 && (
                          <span className="text-xs text-gray-400">({account.expense_count})</span>
                        )}
                      </span>
                      <span className="font-medium text-red-600">-{formatCurrency(account.total_expenses)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between items-center py-1.5 bg-gray-50 -mx-2 px-2 rounded">
                        <span className="font-medium text-gray-700">Saldo Final</span>
                        <span className="font-bold text-gray-900 text-lg">{formatCurrency(account.closing_balance)}</span>
                      </div>
                    </div>
                    {/* Net Flow indicator */}
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs text-gray-400">Flujo Neto</span>
                      <span className={`text-sm font-medium ${account.net_flow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {account.net_flow >= 0 ? '+' : ''}{formatCurrency(account.net_flow)}
                      </span>
                    </div>

                    {/* Breakdown Toggle Button */}
                    {hasBreakdownData(account.breakdown_by_category) && (
                      <button
                        onClick={() => toggleExpand(account.account_id)}
                        className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 py-2 border-t border-gray-100 transition-colors"
                      >
                        {expandedAccounts.has(account.account_id) ? (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            Ocultar desglose
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            Ver desglose por origen
                          </>
                        )}
                      </button>
                    )}

                    {/* Breakdown by Category */}
                    {expandedAccounts.has(account.account_id) && account.breakdown_by_category && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Desglose por Origen
                        </h4>
                        {(Object.keys(CATEGORY_CONFIG) as Array<keyof CategoryBreakdown>).map(catKey => {
                          const catData = account.breakdown_by_category![catKey];
                          if (catData.count === 0) return null;
                          const config = CATEGORY_CONFIG[catKey];
                          const CatIcon = config.icon;
                          return (
                            <div key={catKey} className="flex items-center justify-between py-1.5 px-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <CatIcon className={`w-4 h-4 ${config.color}`} />
                                <span className="text-sm text-gray-700">{config.label}</span>
                                <span className="text-xs text-gray-400">({catData.count})</span>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                {catData.income > 0 && (
                                  <span className="text-green-600">+{formatCurrency(catData.income)}</span>
                                )}
                                {catData.expense > 0 && (
                                  <span className="text-red-600">-{formatCurrency(catData.expense)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Summary */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl shadow-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              Resumen Total del Dia
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-xs mb-1">Saldo Inicial</p>
                <p className="text-xl font-bold">{formatCurrency(dailyFlow.totals.opening_balance)}</p>
              </div>
              <div className="text-center">
                <p className="text-green-400 text-xs mb-1">Total Entradas</p>
                <p className="text-xl font-bold text-green-400">+{formatCurrency(dailyFlow.totals.total_income)}</p>
              </div>
              <div className="text-center">
                <p className="text-red-400 text-xs mb-1">Total Salidas</p>
                <p className="text-xl font-bold text-red-400">-{formatCurrency(dailyFlow.totals.total_expenses)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs mb-1">Saldo Final</p>
                <p className="text-xl font-bold">{formatCurrency(dailyFlow.totals.closing_balance)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-xs mb-1">Flujo Neto</p>
                <p className={`text-xl font-bold ${dailyFlow.totals.net_flow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {dailyFlow.totals.net_flow >= 0 ? '+' : ''}{formatCurrency(dailyFlow.totals.net_flow)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CashRegister;
