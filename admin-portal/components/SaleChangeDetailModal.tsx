'use client';

/**
 * SaleChangeDetailModal - Modal showing detailed information about a sale change
 * Includes product details, transactions, inventory movements, and associated orders
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Package,
  ArrowRight,
  DollarSign,
  History,
  ShoppingCart,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building2,
  Calendar,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Box,
} from 'lucide-react';
import salesService from '@/lib/services/salesService';
import type { SaleChangeDetailResponse, SaleChangeListItem } from '@/lib/api';

interface SaleChangeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  changeId: string | null;
  change?: SaleChangeListItem;
}

const CHANGE_TYPE_LABELS: Record<string, string> = {
  size_change: 'Cambio de Talla',
  product_change: 'Cambio de Producto',
  return: 'Devolucion',
  defect: 'Defecto',
};

const CHANGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  pending_stock: 'Esperando Stock',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const CHANGE_STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" /> },
  pending_stock: { color: 'bg-amber-100 text-amber-700', icon: <AlertCircle className="w-4 h-4" /> },
  approved: { color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
  rejected: { color: 'bg-red-100 text-red-700', icon: <XCircle className="w-4 h-4" /> },
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  });
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(value);
};

export default function SaleChangeDetailModal({
  isOpen,
  onClose,
  changeId,
  change,
}: SaleChangeDetailModalProps) {
  const router = useRouter();
  const [details, setDetails] = useState<SaleChangeDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && changeId) {
      loadDetails();
    } else {
      setDetails(null);
      setError(null);
    }
  }, [isOpen, changeId]);

  const loadDetails = async () => {
    if (!changeId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await salesService.getChangeDetails(changeId);
      setDetails(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar detalles';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const displayData = details || change;
  const statusConfig = displayData ? CHANGE_STATUS_CONFIG[displayData.status] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-brand-600" />
            <h2 className="text-xl font-semibold text-slate-800">
              Detalle del Cambio
            </h2>
            {displayData && statusConfig && (
              <span className={`px-3 py-1 inline-flex items-center gap-1 text-sm font-semibold rounded-full ${statusConfig.color}`}>
                {statusConfig.icon}
                {CHANGE_STATUS_LABELS[displayData.status]}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && !displayData && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
              <span className="ml-3 text-slate-600">Cargando detalles...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          )}

          {displayData && (
            <div className="space-y-6">
              {/* General Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  INFORMACION GENERAL
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Tipo:</span>
                    <p className="font-medium">{CHANGE_TYPE_LABELS[displayData.change_type] || displayData.change_type}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Fecha:</span>
                    <p className="font-medium">{formatDate(displayData.change_date)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Usuario:</span>
                    <p className="font-medium">{displayData.user_username || displayData.user_name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Venta:</span>
                    <button
                      onClick={() => {
                        onClose();
                        router.push(`/sales/${displayData.sale_id}`);
                      }}
                      className="font-medium text-brand-600 hover:text-brand-800 hover:underline"
                    >
                      {displayData.sale_code}
                    </button>
                  </div>
                </div>
                {displayData.reason && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <span className="text-slate-500 text-sm">Motivo:</span>
                    <p className="text-sm text-slate-900 mt-1">{displayData.reason}</p>
                  </div>
                )}
                {displayData.rejection_reason && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <span className="text-red-500 text-sm">Razon de Rechazo:</span>
                    <p className="text-sm text-red-700 mt-1">{displayData.rejection_reason}</p>
                  </div>
                )}
              </div>

              {/* Products Section */}
              <div className="bg-brand-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  PRODUCTOS INVOLUCRADOS
                </h3>
                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                  {/* Original Product */}
                  <div className="flex-1 bg-white rounded-lg p-4 border border-slate-200">
                    <div className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      PRODUCTO DEVUELTO
                    </div>
                    <div className="space-y-1">
                      <p className="font-mono text-sm font-bold text-slate-900">
                        {displayData.original_product_code || 'N/A'}
                      </p>
                      <p className="text-sm text-slate-700">
                        {displayData.original_product_name || 'Producto no disponible'}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        {displayData.original_product_size && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded">
                            Talla: {displayData.original_product_size}
                          </span>
                        )}
                        {displayData.original_product_color && (
                          <span className="bg-slate-100 px-2 py-0.5 rounded">
                            {displayData.original_product_color}
                          </span>
                        )}
                        {displayData.original_is_global && (
                          <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            Global
                          </span>
                        )}
                      </div>
                      <div className="pt-2 border-t border-slate-100 mt-2">
                        <p className="text-xs text-slate-500">Cantidad: <span className="font-semibold text-slate-900">{displayData.returned_quantity}</span></p>
                        {displayData.original_unit_price && (
                          <p className="text-xs text-slate-500">
                            P. Unitario: <span className="font-semibold text-slate-900">{formatCurrency(displayData.original_unit_price)}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Arrow */}
                  {displayData.new_product_code && (
                    <div className="flex items-center justify-center md:py-0 py-2">
                      <ArrowRight className="w-8 h-8 text-brand-400 transform md:rotate-0 rotate-90" />
                    </div>
                  )}

                  {/* New Product */}
                  {displayData.new_product_code ? (
                    <div className="flex-1 bg-white rounded-lg p-4 border border-slate-200">
                      <div className="text-xs font-semibold text-green-600 mb-2 flex items-center gap-1">
                        <TrendingDown className="w-3 h-3" />
                        PRODUCTO NUEVO
                      </div>
                      <div className="space-y-1">
                        <p className="font-mono text-sm font-bold text-slate-900">
                          {displayData.new_product_code}
                        </p>
                        <p className="text-sm text-slate-700">
                          {displayData.new_product_name || 'Producto no disponible'}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {displayData.new_product_size && (
                            <span className="bg-slate-100 px-2 py-0.5 rounded">
                              Talla: {displayData.new_product_size}
                            </span>
                          )}
                          {displayData.new_product_color && (
                            <span className="bg-slate-100 px-2 py-0.5 rounded">
                              {displayData.new_product_color}
                            </span>
                          )}
                          {displayData.new_is_global && (
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                              Global
                            </span>
                          )}
                        </div>
                        <div className="pt-2 border-t border-slate-100 mt-2">
                          <p className="text-xs text-slate-500">Cantidad: <span className="font-semibold text-slate-900">{displayData.new_quantity}</span></p>
                          {displayData.new_unit_price && (
                            <p className="text-xs text-slate-500">
                              P. Unitario: <span className="font-semibold text-slate-900">{formatCurrency(displayData.new_unit_price)}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 bg-slate-100 rounded-lg p-4 border border-slate-200 flex items-center justify-center">
                      <span className="text-slate-500 text-sm italic">Sin producto de reemplazo (devolucion)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Price Adjustment */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  AJUSTE FINANCIERO
                </h3>
                <div className={`text-2xl font-bold ${displayData.price_adjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {displayData.price_adjustment >= 0 ? '+' : ''}{formatCurrency(displayData.price_adjustment)}
                </div>
                <p className="text-sm text-slate-600 mt-1">
                  {displayData.price_adjustment > 0
                    ? 'El cliente debe pagar esta diferencia'
                    : displayData.price_adjustment < 0
                    ? 'Devolucion al cliente'
                    : 'Sin ajuste de precio'}
                </p>
              </div>

              {/* Traceability Section */}
              {details && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <History className="w-4 h-4" />
                    TRAZABILIDAD
                  </h3>

                  {/* Transactions */}
                  {details.transactions && details.transactions.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-slate-600 mb-2">Transacciones Contables:</h4>
                      <div className="space-y-2">
                        {details.transactions.map((t) => (
                          <div key={t.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-700">{t.description || t.type}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className={`font-semibold ${Number(t.amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(Number(t.amount))}
                              </span>
                              <span className="text-xs text-slate-400">{formatDate(t.transaction_date)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inventory Movements */}
                  {details.inventory_movements && details.inventory_movements.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-slate-600 mb-2">Movimientos de Inventario:</h4>
                      <div className="space-y-2">
                        {details.inventory_movements.map((m) => (
                          <div key={m.id} className="flex items-center justify-between bg-white rounded px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Box className="w-4 h-4 text-slate-400" />
                              <span className="font-mono text-xs text-slate-600">{m.product_code}</span>
                              <span className="text-slate-700">{m.product_name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                m.movement_type === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {m.movement_type === 'entrada' ? '+' : '-'}{m.quantity}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Associated Order */}
                  {details.associated_order && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-600 mb-2">Pedido Asociado:</h4>
                      <button
                        onClick={() => {
                          onClose();
                          router.push(`/orders/${details.associated_order!.id}`);
                        }}
                        className="flex items-center gap-2 bg-white rounded px-3 py-2 text-sm hover:bg-slate-50 transition-colors w-full"
                      >
                        <ShoppingCart className="w-4 h-4 text-brand-500" />
                        <span className="font-medium text-brand-600">{details.associated_order.code}</span>
                        <span className="text-slate-500">- {details.associated_order.status}</span>
                        {details.associated_order.delivery_date && (
                          <span className="text-xs text-slate-400 ml-auto">
                            Entrega: {new Date(details.associated_order.delivery_date).toLocaleDateString('es-CO')}
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {/* No traceability data message */}
                  {(!details.transactions || details.transactions.length === 0) &&
                   (!details.inventory_movements || details.inventory_movements.length === 0) &&
                   !details.associated_order && (
                    <p className="text-sm text-slate-500 italic">
                      No hay movimientos registrados para este cambio.
                    </p>
                  )}
                </div>
              )}

              {/* Sale Info */}
              {details && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    VENTA ORIGINAL
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Codigo:</span>
                      <button
                        onClick={() => {
                          onClose();
                          router.push(`/sales/${details.sale_id}`);
                        }}
                        className="block font-medium text-brand-600 hover:text-brand-800 hover:underline"
                      >
                        {details.sale_code}
                      </button>
                    </div>
                    <div>
                      <span className="text-slate-500">Total:</span>
                      <p className="font-medium">{formatCurrency(details.sale_total)}</p>
                    </div>
                    {details.client_name && (
                      <div>
                        <span className="text-slate-500">Cliente:</span>
                        <p className="font-medium">{details.client_name}</p>
                      </div>
                    )}
                    {details.school_name && (
                      <div>
                        <span className="text-slate-500">Colegio:</span>
                        <p className="font-medium">{details.school_name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
