/**
 * MonthlySalesAnalysis Component - Monthly sales data and trends
 */
import React from 'react';
import { Loader2, AlertCircle, BarChart3, TrendingUp, PieChart, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import BarChart from '../BarChart';
import { getMonthOptions, type School, type MonthlySalesReport } from './types';

interface MonthlySalesAnalysisProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  monthlyData: MonthlySalesReport | null;
  salesSchoolFilter: string;
  onSchoolFilterChange: (schoolId: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  allSchools: School[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  nequi: 'Nequi',
  card: 'Tarjeta',
  credit: 'Credito',
  other: 'Otro'
};

const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: 'bg-green-100 text-green-800',
  transfer: 'bg-blue-100 text-blue-800',
  nequi: 'bg-purple-100 text-purple-800',
  card: 'bg-orange-100 text-orange-800',
  credit: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800'
};

const MonthlySalesAnalysis: React.FC<MonthlySalesAnalysisProps> = ({
  loading,
  error,
  onRetry,
  monthlyData,
  salesSchoolFilter,
  onSchoolFilterChange,
  selectedMonth,
  onMonthChange,
  allSchools
}) => {
  const monthOptions = getMonthOptions();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600">Cargando analisis mensual...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-red-700 hover:text-red-800 underline"
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
      {/* School Filter and Month Selector */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span className="text-sm font-medium text-gray-700">Filtros:</span>
          </div>
          <select
            value={salesSchoolFilter}
            onChange={(e) => onSchoolFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Todos los colegios</option>
            {allSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}{!school.is_active && ' (inactivo)'}
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Ver todos los meses</option>
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Analysis Content */}
      {monthlyData && (
        <>
          {/* KPIs Summary */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-sm p-6 mb-6 text-white">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Resumen del Periodo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-indigo-200 text-sm">Total Ventas</p>
                <p className="text-3xl font-bold">{monthlyData.totals.sales_count.toLocaleString('es-CO')}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-sm">Ingresos Totales</p>
                <p className="text-3xl font-bold">{formatCurrency(monthlyData.totals.total_revenue)}</p>
              </div>
              <div>
                <p className="text-indigo-200 text-sm">Ticket Promedio</p>
                <p className="text-3xl font-bold">{formatCurrency(monthlyData.totals.average_ticket)}</p>
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          {monthlyData.months.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-indigo-600" />
                Tendencia de Ingresos por Mes
              </h3>
              <BarChart
                data={monthlyData.months.map((m) => ({
                  label: m.period_label.split(' ')[0].substring(0, 3), // "Ene", "Feb", etc.
                  value: m.total_revenue,
                  secondaryValue: m.sales_count
                }))}
                height={250}
                barColor="#6366F1"
                secondaryColor="#10B981"
                formatValue={(v) => {
                  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
                  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
                  return `$${v}`;
                }}
              />
            </div>
          )}

          {/* Monthly Data Table */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
              <h3 className="text-lg font-semibold text-gray-800">
                Desglose Mensual
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Periodo: {monthlyData.start_date} a {monthlyData.end_date}
              </p>
            </div>

            {monthlyData.months.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mes
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ventas
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ingresos
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ticket Prom.
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        % del Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tendencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {monthlyData.months.map((month, index) => {
                      const prevMonth = index > 0 ? monthlyData.months[index - 1] : null;
                      const trend = prevMonth
                        ? ((month.total_revenue - prevMonth.total_revenue) / prevMonth.total_revenue) * 100
                        : 0;
                      const percentOfTotal = (month.total_revenue / monthlyData.totals.total_revenue) * 100;

                      return (
                        <tr key={month.period} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{month.period_label}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span className="text-sm text-gray-900">{month.sales_count.toLocaleString('es-CO')}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span className="text-sm font-medium text-gray-900">{formatCurrency(month.total_revenue)}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span className="text-sm text-gray-600">{formatCurrency(month.average_ticket)}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full"
                                  style={{ width: `${Math.min(percentOfTotal, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">{percentOfTotal.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {prevMonth ? (
                              <span className={`inline-flex items-center text-sm ${
                                trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-500'
                              }`}>
                                {trend > 0 ? (
                                  <ArrowUpRight className="w-4 h-4 mr-1" />
                                ) : trend < 0 ? (
                                  <ArrowDownRight className="w-4 h-4 mr-1" />
                                ) : null}
                                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-indigo-50">
                    <tr>
                      <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-900">
                        Total
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-gray-900">
                        {monthlyData.totals.sales_count.toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-gray-900">
                        {formatCurrency(monthlyData.totals.total_revenue)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-gray-900">
                        {formatCurrency(monthlyData.totals.average_ticket)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-gray-900">
                        100%
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No hay datos para el periodo seleccionado</p>
              </div>
            )}
          </div>

          {/* Payment Methods Breakdown */}
          {monthlyData.months.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <PieChart className="w-5 h-5 mr-2 text-indigo-600" />
                Metodos de Pago (Acumulado)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {(() => {
                  // Aggregate payment methods across all months
                  const paymentTotals: Record<string, { count: number; total: number }> = {};
                  monthlyData.months.forEach((month) => {
                    Object.entries(month.by_payment).forEach(([method, data]) => {
                      if (!paymentTotals[method]) {
                        paymentTotals[method] = { count: 0, total: 0 };
                      }
                      paymentTotals[method].count += data.count;
                      paymentTotals[method].total += data.total;
                    });
                  });

                  return Object.entries(paymentTotals).map(([method, data]) => (
                    <div
                      key={method}
                      className={`p-4 rounded-lg ${PAYMENT_METHOD_COLORS[method] || 'bg-gray-100 text-gray-800'}`}
                    >
                      <p className="text-sm font-medium">{PAYMENT_METHOD_LABELS[method] || method}</p>
                      <p className="text-2xl font-bold">{data.count}</p>
                      <p className="text-sm opacity-75">{formatCurrency(data.total)}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* No data message */}
      {!monthlyData && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-indigo-400" />
          <p className="text-indigo-700">Selecciona un periodo de fechas para ver el analisis mensual</p>
        </div>
      )}
    </>
  );
};

export default MonthlySalesAnalysis;
