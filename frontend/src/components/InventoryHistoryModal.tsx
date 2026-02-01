/**
 * Inventory History Modal
 * Shows movement history for a specific product
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Package, TrendingUp, TrendingDown, History, ExternalLink, User } from 'lucide-react';
import { inventoryLogService, InventoryLog, getMovementTypeInfo, isStockIn } from '../services/inventoryLogService';

interface InventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  productCode: string;
  productSize?: string;
  currentStock?: number;
  schoolId: string;
  isGlobalProduct?: boolean;
}

export default function InventoryHistoryModal({
  isOpen,
  onClose,
  productId,
  productName,
  productCode,
  productSize,
  currentStock,
  schoolId,
  isGlobalProduct = false,
}: InventoryHistoryModalProps) {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigate to related entity and close modal
  const handleNavigateToSale = (saleId: string) => {
    onClose();
    navigate(`/sales/${saleId}`);
  };

  const handleNavigateToOrder = (orderId: string) => {
    onClose();
    navigate(`/orders/${orderId}`);
  };

  const handleNavigateToChange = (changeId: string) => {
    onClose();
    navigate(`/changes/${changeId}`);
  };

  useEffect(() => {
    if (isOpen && productId) {
      loadLogs();
    }
  }, [isOpen, productId, schoolId, isGlobalProduct]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      let data: InventoryLog[];
      if (isGlobalProduct) {
        data = await inventoryLogService.getGlobalProductLogs(productId, 50);
      } else {
        data = await inventoryLogService.getProductLogs(schoolId, productId, 50);
      }
      setLogs(data);
    } catch (err: any) {
      console.error('Error loading inventory logs:', err);
      setError(err.response?.data?.detail || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center">
              <History className="w-5 h-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Historial de Movimientos</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Product Info */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Producto</p>
                <p className="font-medium text-gray-900">{productName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono text-gray-500">{productCode}</span>
                  {productSize && (
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                      Talla: {productSize}
                    </span>
                  )}
                  {isGlobalProduct && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      Global
                    </span>
                  )}
                </div>
              </div>
              {currentStock !== undefined && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Stock Actual</p>
                  <p className="text-2xl font-bold text-gray-900">{currentStock}</p>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Cargando historial...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-700">{error}</p>
                <button
                  onClick={loadLogs}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Reintentar
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Package className="w-12 h-12 mb-2" />
                <p>No hay movimientos registrados</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Fecha
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Tipo
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Cantidad
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                      Stock
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Referencia
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Usuario
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => {
                    const typeInfo = getMovementTypeInfo(log.movement_type);
                    const stockIn = isStockIn(log.movement_type);
                    const isManualAdjustment = log.movement_type === 'adjustment_in' || log.movement_type === 'adjustment_out';

                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeInfo.bgColor} ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={`inline-flex items-center font-medium ${
                              stockIn ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {stockIn ? (
                              <TrendingUp className="w-3 h-3 mr-1" />
                            ) : (
                              <TrendingDown className="w-3 h-3 mr-1" />
                            )}
                            {stockIn ? '+' : ''}
                            {log.quantity_delta}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">
                          {log.quantity_after}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">
                          {log.sale_id ? (
                            <button
                              onClick={() => handleNavigateToSale(log.sale_id!)}
                              className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                              title="Ver detalle de venta"
                            >
                              {log.reference || 'Ver venta'}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </button>
                          ) : log.order_id ? (
                            <button
                              onClick={() => handleNavigateToOrder(log.order_id!)}
                              className="inline-flex items-center text-orange-600 hover:text-orange-800 hover:underline font-mono text-xs"
                              title="Ver detalle de encargo"
                            >
                              {log.reference || 'Ver encargo'}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </button>
                          ) : log.sale_change_id ? (
                            <button
                              onClick={() => handleNavigateToChange(log.sale_change_id!)}
                              className="inline-flex items-center text-purple-600 hover:text-purple-800 hover:underline font-mono text-xs"
                              title="Ver detalle de cambio"
                            >
                              {log.reference || 'Ver cambio'}
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </button>
                          ) : log.reference ? (
                            <span className="font-mono text-xs">{log.reference}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {log.created_by_name ? (
                            <span className={`inline-flex items-center ${isManualAdjustment ? 'text-amber-700 font-medium' : 'text-gray-600'}`}>
                              <User className="w-3 h-3 mr-1" />
                              {log.created_by_name}
                            </span>
                          ) : (
                            <span className="text-gray-400">Sistema</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">
                {logs.length > 0 ? `Mostrando últimos ${logs.length} movimientos` : ''}
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
