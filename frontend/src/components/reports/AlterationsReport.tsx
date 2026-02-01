/**
 * AlterationsReport Component - Alterations summary and list
 */
import React from 'react';
import { Loader2, AlertCircle, Scissors, Clock, CheckCircle, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import { ALTERATION_TYPE_LABELS, ALTERATION_STATUS_LABELS, ALTERATION_STATUS_COLORS } from '../../types/api';
import type { AlterationsSummary, AlterationListItem } from './types';

interface AlterationsReportProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  alterationsSummary: AlterationsSummary | null;
  alterationsList: AlterationListItem[];
  dateRangeLabel: string;
}

const AlterationsReport: React.FC<AlterationsReportProps> = ({
  loading,
  error,
  onRetry,
  alterationsSummary,
  alterationsList,
  dateRangeLabel
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        <span className="ml-3 text-gray-600">Cargando datos de arreglos...</span>
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
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Scissors className="w-4 h-4" />
              Total
            </div>
            <p className="text-2xl font-semibold text-gray-900">{alterationsSummary.total_count}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 shadow-sm border border-yellow-100">
            <div className="flex items-center gap-2 text-yellow-700 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Pendientes
            </div>
            <p className="text-2xl font-semibold text-yellow-700">{alterationsSummary.pending_count}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-2 text-blue-700 text-sm mb-1">
              <Scissors className="w-4 h-4" />
              En Proceso
            </div>
            <p className="text-2xl font-semibold text-blue-700">{alterationsSummary.in_progress_count}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100">
            <div className="flex items-center gap-2 text-green-700 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Listos
            </div>
            <p className="text-2xl font-semibold text-green-700">{alterationsSummary.ready_count}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Ingresos
            </div>
            <p className="text-xl font-semibold text-gray-900">{formatCurrency(alterationsSummary.total_revenue)}</p>
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

      {/* Alterations Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <h2 className="text-lg font-semibold text-gray-800">
            Listado de Arreglos
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {dateRangeLabel || 'Todos los arreglos'}
          </p>
        </div>

        {alterationsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Codigo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prenda
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Costo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recibido
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {alterationsList.map((alteration) => (
                  <tr key={alteration.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-sm text-orange-600 font-medium">
                        {alteration.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {alteration.client_display_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                      {alteration.garment_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
                        {ALTERATION_TYPE_LABELS[alteration.alteration_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${ALTERATION_STATUS_COLORS[alteration.status]}`}>
                        {ALTERATION_STATUS_LABELS[alteration.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-sm font-medium text-gray-900">
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
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
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
          <div className="p-12 text-center text-gray-500">
            <Scissors className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No hay arreglos para el periodo seleccionado</p>
          </div>
        )}
      </div>
    </>
  );
};

export default AlterationsReport;
