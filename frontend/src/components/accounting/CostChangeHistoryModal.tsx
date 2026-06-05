/**
 * Cost Change History Modal — timeline de cambios de costo de un producto.
 *
 * Mirror del InventoryHistoryModal. Muestra entries del cost_change_log
 * filtradas por product_id, paginadas (50 más recientes por defecto).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  X, Loader2, Clock, TrendingUp, TrendingDown, Minus, User, AlertCircle, History,
} from 'lucide-react';
import { getCostHistory } from '../../services/costComponentService';
import type { CostChangeLog } from '../../services/costComponentService';
import { getCostChangeTypeInfo } from '../../utils/cost-change-helpers';
import { formatCurrency } from '../../utils/formatting';

interface CostChangeHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  productCode: string;
  productSize?: string;
  schoolId?: string;
  isGlobalProduct?: boolean;
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Bogota',
  });
};

const formatDelta = (before: number | null, after: number | null) => {
  if (before == null && after != null) return { sign: 'up' as const, label: `+${formatCurrency(after)}` };
  if (before != null && after == null) return { sign: 'down' as const, label: `−${formatCurrency(before)}` };
  if (before != null && after != null) {
    const delta = after - before;
    if (delta === 0) return { sign: 'neutral' as const, label: '0' };
    return delta > 0
      ? { sign: 'up' as const, label: `+${formatCurrency(delta)}` }
      : { sign: 'down' as const, label: `−${formatCurrency(Math.abs(delta))}` };
  }
  return { sign: 'neutral' as const, label: '—' };
};

export default function CostChangeHistoryModal({
  isOpen,
  onClose,
  productId,
  productName,
  productCode,
  productSize,
  schoolId,
  isGlobalProduct = false,
}: CostChangeHistoryModalProps) {
  const [logs, setLogs] = useState<CostChangeLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCostHistory(productId, schoolId, isGlobalProduct, 0, 50);
      setLogs(result.items);
      setTotal(result.total);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }, [productId, schoolId, isGlobalProduct]);

  useEffect(() => {
    if (isOpen && productId) loadLogs();
  }, [isOpen, productId, loadLogs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-stone-100 rounded-full flex items-center justify-center">
                <History className="w-4 h-4 text-stone-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  Historial de costo — {productName} {productSize && <span className="text-stone-400">({productSize})</span>}
                </h3>
                <p className="text-xs text-stone-500 font-mono">{productCode}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-2" aria-label="Cerrar">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="ml-2 text-sm text-stone-500">Cargando historial...</span>
              </div>
            ) : error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-stone-500">
                <Clock className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p>Sin historial todavía</p>
                <p className="text-xs text-stone-400 mt-1">
                  Los cambios futuros en los componentes de costo aparecerán acá.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-stone-500 uppercase">Fecha</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-stone-500 uppercase">Componente</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-stone-500 uppercase">Tipo</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-stone-500 uppercase">Cambio</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-stone-500 uppercase">Razón</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-stone-500 uppercase">Usuario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {logs.map(log => {
                    const info = getCostChangeTypeInfo(log.change_type);
                    const delta = formatDelta(log.amount_before, log.amount_after);
                    const TrendIcon = delta.sign === 'up' ? TrendingUp
                      : delta.sign === 'down' ? TrendingDown : Minus;
                    return (
                      <tr key={log.id} className="hover:bg-stone-50">
                        <td className="px-3 py-2 text-xs text-stone-600 whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-stone-900">{log.template_name || '—'}</span>
                            {log.template_code && (
                              <code className="text-[10px] text-stone-400 font-mono">{log.template_code}</code>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${info.color} ${info.bgColor}`}>
                            {info.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className={`inline-flex items-center gap-1 font-medium ${
                            delta.sign === 'up' ? 'text-green-700'
                            : delta.sign === 'down' ? 'text-red-700'
                            : 'text-stone-400'
                          }`}>
                            <TrendIcon className="w-3.5 h-3.5" />
                            <span>{delta.label}</span>
                          </div>
                          {log.amount_before != null && log.amount_after != null && (
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              {formatCurrency(log.amount_before)} → {formatCurrency(log.amount_after)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-stone-600 max-w-[200px] truncate" title={log.reason || ''}>
                          {log.reason || '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-stone-600">
                          <div className="inline-flex items-center gap-1">
                            <User className="w-3 h-3 text-stone-400" />
                            {log.changed_by_name || <span className="text-stone-400">Sistema</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
            <span className="text-xs text-stone-500">
              {loading ? '' : total > 0 ? `Mostrando ${logs.length} de ${total} cambios` : ''}
            </span>
            <button onClick={onClose} className="px-4 py-2 text-sm text-stone-700 hover:bg-stone-100 rounded-lg">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
