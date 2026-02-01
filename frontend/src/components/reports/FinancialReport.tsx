/**
 * FinancialReport Component - Transactions table, expenses by category, cash flow
 */
import React from 'react';
import {
  Loader2, AlertCircle, ArrowUpRight, ArrowDownRight,
  Wallet, TrendingUp, Receipt, PieChart
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { formatDateDisplay, type TransactionItem, type ExpenseCategory, type CashFlowReport } from './types';

interface FinancialReportProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  transactions: TransactionItem[];
  expensesByCategory: ExpenseCategory[];
  cashFlow: CashFlowReport | null;
  dateRangeLabel: string;
}

const FinancialReport: React.FC<FinancialReportProps> = ({
  loading,
  error,
  onRetry,
  transactions,
  expensesByCategory,
  cashFlow,
  dateRangeLabel
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        <span className="ml-3 text-gray-600">Cargando datos financieros...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">Error al cargar datos financieros</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Financial KPI Cards */}
      {cashFlow && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Total Income */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-green-100 rounded-lg">
                <ArrowUpRight className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs text-gray-500">Ingresos</span>
            </div>
            <h3 className="text-2xl font-bold text-green-600">
              {formatCurrency(cashFlow.total_income)}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Total del periodo</p>
          </div>

          {/* Total Expenses */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-red-100 rounded-lg">
                <ArrowDownRight className="w-6 h-6 text-red-600" />
              </div>
              <span className="text-xs text-gray-500">Gastos</span>
            </div>
            <h3 className="text-2xl font-bold text-red-600">
              {formatCurrency(cashFlow.total_expenses)}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Total del periodo</p>
          </div>

          {/* Net Flow */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${cashFlow.net_flow >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                <Wallet className={`w-6 h-6 ${cashFlow.net_flow >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
              <span className="text-xs text-gray-500">Flujo Neto</span>
            </div>
            <h3 className={`text-2xl font-bold ${cashFlow.net_flow >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {cashFlow.net_flow >= 0 ? '+' : ''}{formatCurrency(cashFlow.net_flow)}
            </h3>
            <p className="text-sm text-gray-600 mt-1">Ingresos - Gastos</p>
          </div>
        </div>
      )}

      {/* Cash Flow Chart (simplified bar visualization) */}
      {cashFlow && cashFlow.periods.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center mb-4">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
            Flujo de Caja por Periodo
          </h2>
          <div className="space-y-3">
            {cashFlow.periods.slice(0, 10).map((period) => {
              const maxValue = Math.max(...cashFlow.periods.map(p => Math.max(p.income, p.expenses)));
              const incomeWidth = maxValue > 0 ? (period.income / maxValue) * 100 : 0;
              const expenseWidth = maxValue > 0 ? (period.expenses / maxValue) * 100 : 0;
              return (
                <div key={period.period} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-gray-600 flex-shrink-0">
                    {period.period_label}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 bg-green-500 rounded"
                        style={{ width: `${incomeWidth}%`, minWidth: period.income > 0 ? '4px' : '0' }}
                      />
                      <span className="text-xs text-green-600">{formatCurrency(period.income)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 bg-red-500 rounded"
                        style={{ width: `${expenseWidth}%`, minWidth: period.expenses > 0 ? '4px' : '0' }}
                      />
                      <span className="text-xs text-red-600">{formatCurrency(period.expenses)}</span>
                    </div>
                  </div>
                  <div className={`w-24 text-right text-sm font-medium ${period.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    {period.net >= 0 ? '+' : ''}{formatCurrency(period.net)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span>Ingresos</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded" />
              <span>Gastos</span>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Transactions & Expenses by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <Receipt className="w-5 h-5 mr-2 text-blue-600" />
              Ultimas Transacciones
            </h2>
            <p className="text-sm text-gray-500 mt-1">{dateRangeLabel || 'Periodo seleccionado'}</p>
          </div>
          {transactions.length > 0 ? (
            <div className="overflow-x-auto max-h-96">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Descripcion
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.slice(0, 20).map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatDateDisplay(tx.transaction_date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-900 line-clamp-1">
                          {tx.description}
                        </div>
                        {tx.school_name && (
                          <div className="text-xs text-gray-500">{tx.school_name}</div>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right text-sm font-medium whitespace-nowrap ${
                        tx.type === 'income' ? 'text-green-600' : tx.type === 'expense' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No hay transacciones para el periodo seleccionado
            </div>
          )}
        </div>

        {/* Expenses by Category */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-purple-600" />
              Gastos por Categoria
            </h2>
            <p className="text-sm text-gray-500 mt-1">{dateRangeLabel || 'Periodo seleccionado'}</p>
          </div>
          {expensesByCategory.length > 0 ? (
            <div className="p-6 space-y-4">
              {expensesByCategory.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{cat.category_label}</span>
                    <span className="text-sm text-gray-600">{formatCurrency(cat.total_amount)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">{Number(cat.percentage).toFixed(1)}%</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>Pagado: {formatCurrency(cat.paid_amount)}</span>
                    {cat.pending_amount > 0 && (
                      <span className="text-orange-600">Pendiente: {formatCurrency(cat.pending_amount)}</span>
                    )}
                    <span>{cat.count} gastos</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No hay gastos para el periodo seleccionado
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FinancialReport;
