/**
 * TransferHistory - Shows a table/list of inter-account transfers with filtering
 *
 * Uses getTransferHistory from globalAccountingService.
 * Supports date range filtering and pagination.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ArrowRightLeft, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { getTransferHistory } from '../../services/globalAccountingService';
import type { TransferHistoryItem, TransferHistoryResponse } from '../../services/globalAccountingService';
import { formatCurrency } from '../../utils/formatting';

interface TransferHistoryProps {
  refreshTrigger?: number;
}

const PAGE_SIZE = 50;

/**
 * Returns Tailwind badge classes based on account code
 */
const getAccountBadgeClasses = (code: string | null): string => {
  switch (code) {
    case '1101':
      return 'bg-yellow-100 text-yellow-800';
    case '1102':
      return 'bg-green-100 text-green-800';
    case '1103':
      return 'bg-purple-100 text-purple-800';
    case '1104':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Format a date string to "27 ene 2026, 3:45 PM" style
 */
const formatTransferDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const TransferHistory: React.FC<TransferHistoryProps> = ({ refreshTrigger }) => {
  const [data, setData] = useState<TransferHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStart, setAppliedStart] = useState<string | undefined>(undefined);
  const [appliedEnd, setAppliedEnd] = useState<string | undefined>(undefined);

  // Pagination
  const [offset, setOffset] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTransferHistory({
        startDate: appliedStart,
        endDate: appliedEnd,
        limit: PAGE_SIZE,
        offset,
      });
      setData(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar transferencias';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [appliedStart, appliedEnd, offset]);

  // Load on mount, when filters change, or when refreshTrigger changes
  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  const handleApplyFilter = () => {
    setOffset(0);
    setAppliedStart(startDate || undefined);
    setAppliedEnd(endDate || undefined);
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    setOffset(0);
    setAppliedStart(undefined);
    setAppliedEnd(undefined);
  };

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - PAGE_SIZE));
  };

  const handleNextPage = () => {
    setOffset((prev) => prev + PAGE_SIZE);
  };

  const items = data?.items || [];
  const total = data?.total || 0;
  const currentStart = offset + 1;
  const currentEnd = Math.min(offset + PAGE_SIZE, total);
  const hasNext = offset + PAGE_SIZE < total;
  const hasPrev = offset > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            Historial de Transferencias
          </h3>

          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500 whitespace-nowrap">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="flex items-center gap-1">
              <label className="text-xs text-gray-500 whitespace-nowrap">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              onClick={handleApplyFilter}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" />
              Aplicar
            </button>
            {(appliedStart || appliedEnd) && (
              <button
                onClick={handleClearFilter}
                className="px-3 py-1.5 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="px-6 py-8 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <ArrowRightLeft className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 text-sm">No hay transferencias registradas</p>
            {(appliedStart || appliedEnd) && (
              <p className="text-gray-400 text-xs mt-1">Intenta con otro rango de fechas</p>
            )}
          </div>
        )}

        {/* Desktop table */}
        {!error && items.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Origen → Destino
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motivo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuario
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item: TransferHistoryItem) => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                        {formatTransferDate(item.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccountBadgeClasses(item.from_account_code)}`}
                          >
                            {item.from_account_name}
                          </span>
                          <span className="text-gray-400 text-sm">→</span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccountBadgeClasses(item.to_account_code)}`}
                          >
                            {item.to_account_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-green-600 whitespace-nowrap">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {item.created_by_name || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-gray-200">
              {items.map((item: TransferHistoryItem) => (
                <div key={item.id} className="px-4 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {formatTransferDate(item.created_at)}
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAccountBadgeClasses(item.from_account_code)}`}
                    >
                      {item.from_account_name}
                    </span>
                    <span className="text-gray-400 text-xs">→</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAccountBadgeClasses(item.to_account_code)}`}
                    >
                      {item.to_account_name}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                  )}
                  {item.created_by_name && (
                    <p className="text-xs text-gray-400">{item.created_by_name}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {currentStart}-{currentEnd} de {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={!hasPrev}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                hasPrev
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            <button
              onClick={handleNextPage}
              disabled={!hasNext}
              className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                hasNext
                  ? 'text-gray-700 hover:bg-gray-100'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferHistory;
