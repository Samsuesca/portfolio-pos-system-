/**
 * InventoryLogs Component - Inventory movement logs with filters
 */
import React from 'react';
import { Loader2, AlertCircle, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { getMovementTypeInfo, isStockIn, type InventoryLog } from '../../services/inventoryLogService';
import type { School } from './types';

interface InventoryLogsProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  inventoryLogs: InventoryLog[];
  inventoryLogsTotal: number;
  inventorySchoolFilter: string;
  onSchoolFilterChange: (schoolId: string) => void;
  inventoryTypeFilter: string;
  onTypeFilterChange: (type: string) => void;
  availableSchools: School[];
  dateRangeLabel: string;
}

const MOVEMENT_TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'sale', label: 'Venta' },
  { value: 'sale_cancel', label: 'Cancelacion Venta' },
  { value: 'order_reserve', label: 'Reserva Encargo' },
  { value: 'order_cancel', label: 'Cancelacion Encargo' },
  { value: 'order_deliver', label: 'Entrega Encargo' },
  { value: 'change_return', label: 'Devolucion Cambio' },
  { value: 'change_out', label: 'Salida Cambio' },
  { value: 'adjustment_in', label: 'Ajuste Entrada' },
  { value: 'adjustment_out', label: 'Ajuste Salida' },
  { value: 'purchase', label: 'Compra' },
  { value: 'initial', label: 'Stock Inicial' },
];

const InventoryLogs: React.FC<InventoryLogsProps> = ({
  loading,
  error,
  onRetry,
  inventoryLogs,
  inventoryLogsTotal,
  inventorySchoolFilter,
  onSchoolFilterChange,
  inventoryTypeFilter,
  onTypeFilterChange,
  availableSchools,
  dateRangeLabel
}) => {
  return (
    <>
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-teal-600" />
            <span className="text-sm font-medium text-gray-700">Colegio:</span>
          </div>
          <select
            value={inventorySchoolFilter}
            onChange={(e) => onSchoolFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">Seleccionar colegio...</option>
            {availableSchools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
          <select
            value={inventoryTypeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            disabled={!inventorySchoolFilter}
          >
            {MOVEMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {inventoryLogsTotal > 0 && (
            <span className="text-sm text-gray-500">
              {inventoryLogsTotal} movimiento{inventoryLogsTotal !== 1 ? 's' : ''} encontrado{inventoryLogsTotal !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* School selection required message */}
      {!inventorySchoolFilter && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 text-teal-400" />
          <p className="text-teal-700">Selecciona un colegio para ver los movimientos de inventario</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
          <span className="ml-3 text-gray-600">Cargando movimientos de inventario...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
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
      )}

      {/* Inventory Logs Table */}
      {inventorySchoolFilter && !loading && !error && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50">
            <h2 className="text-lg font-semibold text-gray-800">
              Historial de Movimientos de Inventario
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {dateRangeLabel || 'Todos los movimientos'}
            </p>
          </div>

          {inventoryLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha / Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cantidad
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stock Despues
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referencia
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {inventoryLogs.map((log) => {
                    const createdAt = new Date(log.created_at);
                    const typeInfo = getMovementTypeInfo(log.movement_type);
                    const stockIn = isStockIn(log.movement_type);

                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {createdAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })}
                          </div>
                          <div className="text-xs text-gray-500">
                            {createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {log.product_name || log.description}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.product_code && <span className="font-mono mr-2">{log.product_code}</span>}
                            {log.product_size && <span>Talla: {log.product_size}</span>}
                            {log.is_global_product && (
                              <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                Global
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.bgColor} ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`inline-flex items-center text-sm font-semibold ${
                            stockIn ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {stockIn ? (
                              <TrendingUp className="w-4 h-4 mr-1" />
                            ) : (
                              <TrendingDown className="w-4 h-4 mr-1" />
                            )}
                            {stockIn ? '+' : ''}{log.quantity_delta}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-sm font-medium text-gray-700">
                          {log.quantity_after}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {log.reference ? (
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                              {log.reference}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No hay movimientos de inventario para el periodo seleccionado</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default InventoryLogs;
