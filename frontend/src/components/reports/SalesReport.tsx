/**
 * SalesReport Component - Global sales summary, top products, top clients
 */
import React from 'react';
import { TrendingUp, Building2, ShoppingBag, Users } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type { School, GlobalSalesSummary, GlobalTopProduct, GlobalTopClient } from './types';

interface SalesReportProps {
  globalSalesSummary: GlobalSalesSummary | null;
  globalTopProducts: GlobalTopProduct[];
  globalTopClients: GlobalTopClient[];
  salesSchoolFilter: string;
  onSchoolFilterChange: (schoolId: string) => void;
  allSchools: School[];
  dateRangeLabel: string;
}

const SalesReport: React.FC<SalesReportProps> = ({
  globalSalesSummary,
  globalTopProducts,
  globalTopClients,
  salesSchoolFilter,
  onSchoolFilterChange,
  allSchools,
  dateRangeLabel
}) => {
  return (
    <>
      {/* School Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Filtrar por colegio:</span>
          </div>
          <select
            value={salesSchoolFilter}
            onChange={(e) => onSchoolFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Todos los colegios</option>
            {allSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}{!school.is_active && ' (inactivo)'}
              </option>
            ))}
          </select>
          {globalSalesSummary && (
            <span className="text-sm text-gray-500">
              {globalSalesSummary.total_sales} ventas encontradas
            </span>
          )}
        </div>
      </div>

      {/* Global Sales Summary */}
      {globalSalesSummary && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-sm p-6 mb-6 text-white">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Resumen del Periodo {!salesSchoolFilter && '(Todos los colegios)'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-blue-200 text-sm">Total Ventas</p>
              <p className="text-3xl font-bold">{globalSalesSummary.total_sales}</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm">Ingresos Totales</p>
              <p className="text-3xl font-bold">{formatCurrency(globalSalesSummary.total_revenue)}</p>
            </div>
            <div>
              <p className="text-blue-200 text-sm">Ticket Promedio</p>
              <p className="text-3xl font-bold">{formatCurrency(globalSalesSummary.average_ticket)}</p>
            </div>
          </div>
          {/* Payment Method Breakdown */}
          {globalSalesSummary.sales_by_payment && Object.keys(globalSalesSummary.sales_by_payment).length > 0 && (
            <div className="mt-4 pt-4 border-t border-blue-500">
              <p className="text-blue-200 text-sm mb-2">Por metodo de pago:</p>
              <div className="flex flex-wrap gap-4">
                {Object.entries(globalSalesSummary.sales_by_payment).map(([method, data]) => (
                  <div key={method} className="bg-blue-500/30 rounded px-3 py-1">
                    <span className="capitalize">{method === 'cash' ? 'Efectivo' : method === 'card' ? 'Tarjeta' : method === 'transfer' ? 'Transferencia' : method === 'credit' ? 'Credito' : method === 'nequi' ? 'Nequi' : method}:</span>
                    <span className="ml-2 font-semibold">{data.count} ({formatCurrency(data.total)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales by School (only when no school filter) */}
      {!salesSchoolFilter && globalSalesSummary && globalSalesSummary.sales_by_school.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-blue-600" />
              Ventas por Colegio
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
                    Ventas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Ingresos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    % del Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {globalSalesSummary.sales_by_school.map((school, index) => {
                  const percentage = globalSalesSummary.total_revenue > 0
                    ? (school.revenue / globalSalesSummary.total_revenue * 100).toFixed(1)
                    : '0';
                  return (
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
                        {school.sales_count}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                        {formatCurrency(school.revenue)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-10">{percentage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Two Column Layout: Top Products & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <ShoppingBag className="w-5 h-5 mr-2 text-blue-600" />
              Productos Mas Vendidos
            </h2>
            <p className="text-sm text-gray-500 mt-1">{dateRangeLabel || 'Periodo seleccionado'}</p>
          </div>
          {globalTopProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Producto
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Vendidos
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Ingresos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {globalTopProducts.map((product, index) => (
                    <tr key={`${product.product_id}-${index}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full text-xs font-bold mr-3">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {product.product_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {product.product_code} - {product.product_size}
                              {!salesSchoolFilter && <span className="ml-1 text-blue-500">({product.school_name})</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {product.units_sold}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                        {formatCurrency(product.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No hay datos de ventas para el periodo seleccionado
            </div>
          )}
        </div>

        {/* Top Clients */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <Users className="w-5 h-5 mr-2 text-green-600" />
              Mejores Clientes
            </h2>
            <p className="text-sm text-gray-500 mt-1">{dateRangeLabel || 'Periodo seleccionado'}</p>
          </div>
          {globalTopClients.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Compras
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {globalTopClients.map((client, index) => (
                    <tr key={client.client_id}>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-600 rounded-full text-xs font-bold mr-3">
                            {index + 1}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {client.client_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {client.client_phone || client.client_code}
                              {!salesSchoolFilter && <span className="ml-1 text-blue-500">({client.school_name})</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        {client.total_purchases}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                        {formatCurrency(client.total_spent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              No hay datos de clientes para el periodo seleccionado
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SalesReport;
