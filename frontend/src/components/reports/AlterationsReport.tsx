/**
 * AlterationsReport Component - Alterations summary and list
 *
 * Fase 2 (Reports Coverage):
 *   - alterationsSummary now respects the date filter (Bug 9 fix)
 *   - new "Tiempo de respuesta" widget below the KPIs showing
 *     production turnaround + overdue pickup
 *   - new "Top tipos de arreglo" widget showing volume distribution
 */
import React from 'react';
import {
  Loader2, AlertCircle, Scissors, Clock, CheckCircle, DollarSign,
  Timer, AlertTriangle, PieChart
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import {
  ALTERATION_TYPE_LABELS, ALTERATION_STATUS_LABELS, ALTERATION_STATUS_COLORS,
  type AlterationsResponseTime, type AlterationsTopType,
} from '../../types/api';
import type { AlterationsSummary, AlterationListItem } from './types';

interface AlterationsReportProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  alterationsSummary: AlterationsSummary | null;
  alterationsList: AlterationListItem[];
  /** Fase 2 — null if backend call not made yet or threw. */
  responseTime?: AlterationsResponseTime | null;
  topTypes?: AlterationsTopType[];
  dateRangeLabel: string;
}

const AlterationsReport: React.FC<AlterationsReportProps> = ({
  loading,
  error,
  onRetry,
  alterationsSummary,
  alterationsList,
  responseTime,
  topTypes,
  dateRangeLabel
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        <span className="ml-3 text-stone-600">Cargando datos de arreglos...</span>
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
      {/* Summary Cards */}
      {alterationsSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-stone-100">
            <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
              <Scissors className="w-4 h-4" />
              Total
            </div>
            <p className="text-2xl font-semibold text-stone-900">{alterationsSummary.total_count}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-700 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Pendientes
            </div>
            <p className="text-2xl font-semibold text-yellow-700">{alterationsSummary.pending_count}</p>
          </div>
          <div className="bg-brand-50 rounded-lg p-4 shadow-sm border border-brand-100">
            <div className="flex items-center gap-2 text-brand-700 text-sm mb-1">
              <Scissors className="w-4 h-4" />
              En Proceso
            </div>
            <p className="text-2xl font-semibold text-brand-700">{alterationsSummary.in_progress_count}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100">
            <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Listos
            </div>
            <p className="text-2xl font-semibold text-green-700">{alterationsSummary.ready_count}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-stone-100">
            <div className="flex items-center gap-2 text-stone-500 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Ingresos
            </div>
            <p className="text-xl font-semibold text-stone-900">{formatCurrency(alterationsSummary.total_revenue)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4 shadow-sm border border-red-100">
            <div className="flex items-center gap-2 text-red-700 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Por Cobrar
            </div>
            <p className="text-xl font-semibold text-red-700">{formatCurrency(alterationsSummary.total_pending_payment)}</p>
          </div>
        </div>
      )}

      {/* Fase 2 — Operational KPIs row: response time + top types */}
      {(responseTime || (topTypes && topTypes.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Tiempo de respuesta widget */}
          {responseTime && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-200">
                <h3 className="text-lg font-semibold text-stone-800 flex items-center">
                  <Timer className="w-5 h-5 mr-2 text-orange-600" />
                  Tiempo de respuesta
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  {dateRangeLabel || 'Todos los arreglos'}
                </p>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-xs text-stone-600">Promedio recibido → listo</p>
                    <p className="text-xl font-semibold text-stone-800 mt-1">
                      {responseTime.avg_received_to_ready_days !== null
                        ? `${responseTime.avg_received_to_ready_days} dias`
                        : '—'}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {responseTime.sample_received_to_ready} arreglos
                    </p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-xs text-stone-600">Mediana</p>
                    <p className="text-xl font-semibold text-stone-800 mt-1">
                      {responseTime.median_received_to_ready_days !== null
                        ? `${responseTime.median_received_to_ready_days} dias`
                        : '—'}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">Resistente a outliers</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-xs text-stone-600">Listo → entregado</p>
                    <p className="text-xl font-semibold text-stone-800 mt-1">
                      {responseTime.avg_ready_to_delivered_days !== null
                        ? `${responseTime.avg_ready_to_delivered_days} dias`
                        : '—'}
                    </p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {responseTime.sample_ready_to_delivered} entregas
                    </p>
                  </div>
                  <div
                    className={`rounded-lg p-3 ${
                      responseTime.overdue_pickup_count > 0
                        ? 'bg-red-50'
                        : 'bg-emerald-50'
                    }`}
                  >
                    <p
                      className={`text-xs ${
                        responseTime.overdue_pickup_count > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      Sin retirar (&gt;{responseTime.overdue_pickup_threshold_days}d)
                    </p>
                    <p
                      className={`text-xl font-semibold mt-1 flex items-center gap-1 ${
                        responseTime.overdue_pickup_count > 0 ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {responseTime.overdue_pickup_count > 0 && (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                      {responseTime.overdue_pickup_count}
                    </p>
                    {responseTime.overdue_pickup_revenue_pending > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {formatCurrency(responseTime.overdue_pickup_revenue_pending)} sin cobrar
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top tipos de arreglo widget */}
          {topTypes && topTypes.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-200">
                <h3 className="text-lg font-semibold text-stone-800 flex items-center">
                  <PieChart className="w-5 h-5 mr-2 text-orange-600" />
                  Top tipos de arreglo
                </h3>
                <p className="text-sm text-stone-500 mt-1">
                  {dateRangeLabel || 'Todos los arreglos'}
                </p>
              </div>
              <div className="p-6 space-y-3">
                {(() => {
                  const maxCount = Math.max(...topTypes.map((t) => t.count), 1);
                  return topTypes.map((t) => {
                    const widthPct = (t.count / maxCount) * 100;
                    return (
                      <div key={t.alteration_type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-stone-700">{t.type_label}</span>
                          <span className="text-stone-500">
                            {t.count} · {formatCurrency(t.revenue)}
                          </span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        {t.avg_response_hours !== null && (
                          <p className="text-xs text-stone-400">
                            Promedio respuesta: {t.avg_response_hours.toFixed(1)}h
                          </p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alterations Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-stone-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <h2 className="text-lg font-semibold text-stone-800">
            Listado de Arreglos
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            {dateRangeLabel || 'Todos los arreglos'}
          </p>
        </div>

        {alterationsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Codigo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Prenda
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Costo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                    Recibido
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100">
                {alterationsList.map((alteration) => (
                  <tr key={alteration.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm text-orange-600 font-medium">
                        {alteration.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-900">
                      {alteration.client_display_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-700">
                      {alteration.garment_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-stone-100 text-stone-700">
                        {ALTERATION_TYPE_LABELS[alteration.alteration_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${ALTERATION_STATUS_COLORS[alteration.status]}`}>
                        {ALTERATION_STATUS_LABELS[alteration.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm font-medium text-stone-900">
                      {formatCurrency(alteration.cost)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {alteration.balance > 0 ? (
                        <span className="text-sm font-medium text-red-600">
                          {formatCurrency(alteration.balance)}
                        </span>
                      ) : (
                        <span className="text-sm text-green-600 flex items-center justify-end gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Pagado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-stone-600">
                      {new Date(alteration.received_date).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-stone-500">
            <Scissors className="w-12 h-12 mx-auto mb-4 text-stone-300" />
            <p>No hay arreglos para el periodo seleccionado</p>
          </div>
        )}
      </div>
    </>
  );
};

export default AlterationsReport;
