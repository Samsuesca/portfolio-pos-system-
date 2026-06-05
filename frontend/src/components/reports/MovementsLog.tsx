/**
 * MovementsLog Component - Balance entries table with account selector
 */
import React from 'react';
import { Loader2, AlertCircle, ScrollText } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type { BalanceEntry, BalanceAccount } from './types';

interface MovementsLogProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  balanceEntries: BalanceEntry[];
  entriesTotal: number;
  selectedAccountId: string;
  onAccountChange: (accountId: string) => void;
  balanceAccounts: BalanceAccount[];
  dateRangeLabel: string;
}

const MovementsLog: React.FC<MovementsLogProps> = ({
  loading,
  error,
  onRetry,
  balanceEntries,
  entriesTotal,
  selectedAccountId,
  onAccountChange,
  balanceAccounts,
  dateRangeLabel
}) => {
  const getAccountBadgeColor = (code: string | null) => {
    switch (code) {
      case '1101':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
      case '1102':
        return 'bg-brand-100 text-brand-700';
      case '1103':
        return 'bg-purple-100 text-purple-800';
      case '1104':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-stone-100 text-stone-800';
    }
  };

  return (
    <>
      {/* Account Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-stone-700">Filtrar por cuenta:</span>
          </div>
          <select
            value={selectedAccountId}
            onChange={(e) => onAccountChange(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="">Todas las cuentas</option>
            {balanceAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.code ? `${account.code} - ` : ''}{account.name}
              </option>
            ))}
          </select>
          {entriesTotal > 0 && (
            <span className="text-sm text-stone-500">
              {entriesTotal} movimiento{entriesTotal !== 1 ? 's' : ''} encontrado{entriesTotal !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-stone-600">Cargando movimientos...</span>
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

      {/* Movements Table */}
      {!loading && !error && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b border-stone-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <h2 className="text-lg font-semibold text-stone-800">
              Historial de Movimientos
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {dateRangeLabel || 'Todos los movimientos'}
            </p>
          </div>

          {balanceEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-100">
                <thead className="bg-stone-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Fecha / Hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Cuenta
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Descripcion
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Referencia
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">
                      Saldo Despues
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-stone-100">
                  {balanceEntries.map((entry) => {
                    const createdAt = new Date(entry.created_at);
                    const isPositive = entry.amount > 0;

                    return (
                      <tr key={entry.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm text-stone-900">
                            {createdAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                          </div>
                          <div className="text-xs text-stone-500">
                            {createdAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAccountBadgeColor(entry.account_code)}`}>
                            {entry.account_name}
                          </span>
                          <div className="text-xs text-stone-400 mt-0.5">{entry.account_code}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-stone-900 max-w-xs truncate" title={entry.description}>
                            {entry.description}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {entry.reference ? (
                            <span className="text-xs font-mono bg-stone-100 px-2 py-1 rounded">
                              {entry.reference}
                            </span>
                          ) : (
                            <span className="text-stone-400 text-xs">-</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right whitespace-nowrap text-sm font-semibold ${
                          isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isPositive ? '+' : ''}{formatCurrency(entry.amount)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-sm text-stone-700">
                          {formatCurrency(entry.balance_after)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-stone-500">
              <ScrollText className="w-12 h-12 mx-auto mb-4 text-stone-300" />
              <p>No hay movimientos para el periodo seleccionado</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MovementsLog;
