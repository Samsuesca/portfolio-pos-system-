/**
 * ProfitabilityReport Component - Profitability metrics by school
 */
import React from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type { ProfitabilityBySchoolResponse } from '../../services/reportsService';

interface ProfitabilityReportProps {
  data: ProfitabilityBySchoolResponse | null;
  loading: boolean;
  dateRangeLabel: string;
}

const ProfitabilityReport: React.FC<ProfitabilityReportProps> = ({
  data,
  loading,
  dateRangeLabel
}) => {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!data || data.schools.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
        No hay datos de rentabilidad para el periodo seleccionado
      </div>
    );
  }

  // Check if any school has low cost coverage
  const lowCoverageSchools = data.schools.filter(s => s.cost_coverage_percent < 50);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
          <p className="text-blue-100 text-sm">Ingresos Totales</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.totals.revenue)}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white">
          <p className="text-orange-100 text-sm">Costo de Ventas</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.totals.cogs)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
          <p className="text-green-100 text-sm">Utilidad Bruta</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(data.totals.gross_profit)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white">
          <p className="text-purple-100 text-sm">Margen Bruto</p>
          <p className="text-2xl font-bold mt-1">{data.totals.gross_margin}%</p>
        </div>
      </div>

      {/* Warning for low cost coverage */}
      {lowCoverageSchools.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Datos de costo incompletos</h4>
              <p className="text-sm text-amber-700 mt-1">
                {lowCoverageSchools.length === 1
                  ? `El colegio ${lowCoverageSchools[0].school_name} tiene menos del 50% de productos con costo real.`
                  : `${lowCoverageSchools.length} colegios tienen menos del 50% de productos con costo real.`
                }
                {' '}Los margenes mostrados son estimados (costo = 80% del precio).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profitability Table by School */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-blue-600" />
            Rentabilidad por Colegio
          </h2>
          <p className="text-sm text-gray-500 mt-1">{dateRangeLabel || 'Periodo seleccionado'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Colegio
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Ingresos
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Costo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Utilidad
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Margen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Cobertura Costos
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.schools.map((school, index) => (
                <tr key={school.school_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-bold mr-3">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{school.school_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-900">
                    {formatCurrency(school.revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-gray-500">
                    {formatCurrency(school.cogs)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                    {formatCurrency(school.gross_profit)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className={`text-sm font-medium ${
                        school.gross_margin >= 25 ? 'text-green-600' :
                        school.gross_margin >= 15 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {school.gross_margin}%
                      </span>
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            school.gross_margin >= 25 ? 'bg-green-500' :
                            school.gross_margin >= 15 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(school.gross_margin * 2, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {school.cost_coverage_percent < 50 && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        school.cost_coverage_percent >= 80 ? 'bg-green-100 text-green-700' :
                        school.cost_coverage_percent >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {school.cost_coverage_percent}% real
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td className="px-6 py-4 text-sm text-gray-900">Total</td>
                <td className="px-6 py-4 text-right text-sm text-gray-900">
                  {formatCurrency(data.totals.revenue)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-500">
                  {formatCurrency(data.totals.cogs)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-green-600">
                  {formatCurrency(data.totals.gross_profit)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-900">
                  {data.totals.gross_margin}%
                </td>
                <td className="px-6 py-4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <p className="font-medium mb-2">Notas:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>El <strong>Costo de Ventas</strong> usa el costo real del producto cuando esta disponible.</li>
          <li>Si el producto no tiene costo asignado, se estima como el 80% del precio de venta.</li>
          <li>La <strong>Cobertura de Costos</strong> indica el porcentaje de productos vendidos con costo real vs estimado.</li>
          <li>Un margen bruto saludable tipicamente es mayor al 25%.</li>
        </ul>
      </div>
    </div>
  );
};

export default ProfitabilityReport;
