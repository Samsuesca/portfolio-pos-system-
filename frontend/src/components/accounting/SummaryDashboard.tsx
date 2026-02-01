/**
 * SummaryDashboard - Dashboard cards and cash balances display
 *
 * Uses dynamic expense categories from useExpenseCategories hook.
 */
import React from 'react';
import {
  Wallet, TrendingDown, Receipt, DollarSign,
  Landmark, CreditCard, Calculator, Pencil, Plus,
  AlertTriangle, Package, ArrowRightLeft
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { formatDateSpanish } from '../DatePicker';
import { useExpenseCategories } from '../../hooks/useExpenseCategories';
import type {
  GlobalDashboardSummary,
  CashBalancesResponse,
  ExpenseListItem,
  GlobalPatrimonySummary
} from './types';

interface SummaryDashboardProps {
  dashboard: GlobalDashboardSummary | null;
  cashBalances: CashBalancesResponse | null;
  patrimony: GlobalPatrimonySummary | null;
  pendingExpenses: ExpenseListItem[];
  onGoToExpenses: () => void;
  onEditBalance?: (account: 'caja_menor' | 'caja_mayor' | 'nequi' | 'banco') => void;
  onCreateExpense: () => void;
  onEditExpense: (expense: ExpenseListItem) => void;
  onPayExpense: (expense: ExpenseListItem) => void;
  onGoToProducts?: () => void;
  onTransfer?: () => void;
}

const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  dashboard,
  cashBalances,
  patrimony,
  pendingExpenses,
  onGoToExpenses,
  onEditBalance,
  onCreateExpense,
  onEditExpense,
  onPayExpense,
  onGoToProducts,
  onTransfer
}) => {
  const formatDate = (dateStr: string) => formatDateSpanish(dateStr);

  // Use dynamic categories from hook
  const { getCategoryLabel, getCategoryColor } = useExpenseCategories();

  return (
    <>
      {/* Summary Cards - Global accounting overview */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Liquidez Total</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(dashboard.cash_balance)}</p>
                <p className="text-xs text-gray-400">Caja + Banco</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <button
            onClick={onGoToExpenses}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-red-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Gastos Totales</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(dashboard.total_expenses)}</p>
                <p className="text-xs text-gray-400">{dashboard.transaction_count} registro(s) - Click para ver</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </button>

          <button
            onClick={onGoToExpenses}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-left hover:shadow-md hover:border-orange-300 transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Gastos Pendientes</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(dashboard.expenses_pending)}</p>
                <p className="text-xs text-gray-400">Por pagar - Click para ver</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Receipt className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Balance Neto</p>
                <p className={`text-2xl font-bold mt-1 ${dashboard.cash_balance - dashboard.expenses_pending >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(dashboard.cash_balance - dashboard.expenses_pending)}
                </p>
                <p className="text-xs text-gray-400">Liquidez - Pendientes</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${dashboard.cash_balance - dashboard.expenses_pending >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <DollarSign className={`w-6 h-6 ${dashboard.cash_balance - dashboard.expenses_pending >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert: Products without cost */}
      {patrimony && patrimony.assets.inventory.products_estimated > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-amber-800 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Productos sin costo asignado
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                <span className="font-semibold">{patrimony.assets.inventory.products_estimated}</span> productos
                no tienen costo real definido. Se usa el 80% del precio como estimado.
                {patrimony.assets.inventory.products_with_cost > 0 && (
                  <span className="ml-1">
                    ({patrimony.assets.inventory.products_with_cost} productos con costo real)
                  </span>
                )}
              </p>
              <p className="text-xs text-amber-600 mt-1.5">
                Para mayor precision, sume tela + confeccion + bordado + accesorios por producto.
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Cobertura actual: {
                  Math.round(
                    (patrimony.assets.inventory.products_with_cost /
                    (patrimony.assets.inventory.products_with_cost + patrimony.assets.inventory.products_estimated)) * 100
                  )
                }% con costo real
              </p>
              {onGoToProducts && (
                <button
                  onClick={onGoToProducts}
                  className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-900 underline"
                >
                  Asignar costos reales →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cash Balances - 3 Cards: Cash (Efectivo), Banco (Digital), Total */}
      {cashBalances && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-blue-600" />
              Saldos Actuales
            </h3>
            {onTransfer && (
              <button
                onClick={onTransfer}
                className="text-sm text-emerald-600 hover:text-emerald-800 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors font-medium"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Transferir
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CASH (Efectivo) = Caja Menor + Caja Mayor */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Efectivo (Cash)
                  </p>
                  <p className="text-2xl font-bold text-emerald-800 mt-1">
                    {formatCurrency((cashBalances.caja_menor?.balance || 0) + (cashBalances.caja_mayor?.balance || 0))}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-700" />
                </div>
              </div>
              {/* Subcuentas */}
              <div className="border-t border-emerald-200 pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">Caja Menor</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-emerald-700">
                      {formatCurrency(cashBalances.caja_menor?.balance || 0)}
                    </span>
                    {onEditBalance && (
                      <button
                        onClick={() => onEditBalance('caja_menor')}
                        className="text-emerald-500 hover:text-emerald-700 p-1"
                        title="Editar Caja Menor"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">Caja Mayor</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-emerald-700">
                      {formatCurrency(cashBalances.caja_mayor?.balance || 0)}
                    </span>
                    {onEditBalance && (
                      <button
                        onClick={() => onEditBalance('caja_mayor')}
                        className="text-emerald-500 hover:text-emerald-700 p-1"
                        title="Editar Caja Mayor"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* BANCO (Digital) = Nequi + Banco */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                    <Landmark className="w-4 h-4" />
                    Banco (Digital)
                  </p>
                  <p className="text-2xl font-bold text-blue-800 mt-1">
                    {formatCurrency((cashBalances.nequi?.balance || 0) + (cashBalances.banco?.balance || 0))}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-700" />
                </div>
              </div>
              {/* Subcuentas */}
              <div className="border-t border-blue-200 pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">Nequi</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-700">
                      {formatCurrency(cashBalances.nequi?.balance || 0)}
                    </span>
                    {onEditBalance && (
                      <button
                        onClick={() => onEditBalance('nequi')}
                        className="text-blue-500 hover:text-blue-700 p-1"
                        title="Editar Nequi"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">Cuenta Bancaria</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-blue-700">
                      {formatCurrency(cashBalances.banco?.balance || 0)}
                    </span>
                    {onEditBalance && (
                      <button
                        onClick={() => onEditBalance('banco')}
                        className="text-blue-500 hover:text-blue-700 p-1"
                        title="Editar Banco"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Total Liquido */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Total Liquido
                  </p>
                  <p className="text-2xl font-bold text-purple-800 mt-1">
                    {formatCurrency(cashBalances.total_liquid)}
                  </p>
                </div>
                <div className="w-10 h-10 bg-purple-200 rounded-full flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-purple-700" />
                </div>
              </div>
              {/* Desglose */}
              <div className="border-t border-purple-200 pt-3 mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-purple-600">
                  <span>Efectivo</span>
                  <span>{formatCurrency((cashBalances.caja_menor?.balance || 0) + (cashBalances.caja_mayor?.balance || 0))}</span>
                </div>
                <div className="flex justify-between text-purple-600">
                  <span>Digital</span>
                  <span>{formatCurrency((cashBalances.nequi?.balance || 0) + (cashBalances.banco?.balance || 0))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Stats Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Resumen Global</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Total de Gastos Registrados</span>
                <span className="font-semibold text-gray-800">{dashboard?.transaction_count || 0}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Gastos Pagados</span>
                <span className="font-semibold text-green-600">{formatCurrency(dashboard?.expenses_paid || 0)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-600">Gastos Por Pagar</span>
                <span className="font-semibold text-orange-600">{formatCurrency(dashboard?.expenses_pending || 0)}</span>
              </div>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Tip:</strong> Usa la seccion "Balance Patrimonial" para ver el balance general completo del negocio incluyendo activos, pasivos e inventario.
              </p>
            </div>
          </div>
        </div>

        {/* Pending Expenses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Gastos Pendientes</h3>
            <button
              onClick={onCreateExpense}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Nuevo
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingExpenses.length === 0 ? (
              <div className="px-6 py-8 text-center text-gray-500">No hay gastos pendientes</div>
            ) : (
              pendingExpenses.slice(0, 8).map((expense) => (
                <div key={expense.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: getCategoryColor(expense.category) }}
                      >
                        {getCategoryLabel(expense.category)}
                      </span>
                      <div className="ml-4">
                        <p className="text-sm font-medium text-gray-800">{expense.description}</p>
                        <p className="text-xs text-gray-500">
                          {expense.vendor && `${expense.vendor} - `}
                          Vence: {expense.due_date ? formatDate(expense.due_date) : 'Sin fecha'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-600">{formatCurrency(expense.balance)}</p>
                      <div className="flex items-center justify-end gap-2 mt-1">
                        <button
                          onClick={() => onEditExpense(expense)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition"
                          title="Editar gasto"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => onPayExpense(expense)}
                          className="text-xs text-green-600 hover:text-green-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-green-50 transition"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Pagar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SummaryDashboard;
