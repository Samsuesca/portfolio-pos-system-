/**
 * SnapshotBalanceSheet - Renders a saved Balance Sheet snapshot
 * with proper formatting (not raw JSON)
 */
import React from 'react';
import { formatCurrency } from '../../utils/formatting';

interface SnapshotBalanceSheetProps {
  data: Record<string, unknown>;
}

// Safe accessors for snapshot data
const num = (val: unknown): number => (typeof val === 'number' ? val : 0);
const str = (val: unknown): string => (typeof val === 'string' ? val : '');
const arr = (val: unknown): Record<string, unknown>[] =>
  Array.isArray(val) ? val : [];

const SnapshotBalanceSheet: React.FC<SnapshotBalanceSheetProps> = ({ data }) => {
  const currentAssets = (data.current_assets ?? {}) as Record<string, unknown>;
  const cashAccounts = arr(currentAssets.cash_accounts);
  const inventory = (currentAssets.inventory ?? {}) as Record<string, unknown>;
  const fixedAssets = arr(data.fixed_assets);
  const currentLiabilities = (data.current_liabilities ?? {}) as Record<string, unknown>;
  const shortTermDebt = arr(currentLiabilities.short_term_debt);
  const longTermLiabilities = arr(data.long_term_liabilities);
  const equity = (data.equity ?? {}) as Record<string, unknown>;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACTIVOS */}
        <div>
          <h5 className="font-bold text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">ACTIVOS</h5>

          {/* Activos Corrientes */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-600 mb-2">Corrientes</p>
            <div className="space-y-1 text-sm">
              {cashAccounts.map((acc, i) => (
                <div key={str(acc.id) || i} className="flex justify-between">
                  <span className="text-gray-600">{str(acc.name)}</span>
                  <span>{formatCurrency(num(acc.balance))}</span>
                </div>
              ))}
              <div className="flex justify-between text-gray-500 border-t pt-1">
                <span>Total Efectivo</span>
                <span>{formatCurrency(num(currentAssets.total_cash))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Cuentas por Cobrar ({num(currentAssets.accounts_receivable_count)})</span>
                <span>{formatCurrency(num(currentAssets.accounts_receivable))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Inventario ({num(inventory.total_units)} uds)</span>
                <span>{formatCurrency(num(currentAssets.total_inventory))}</span>
              </div>
            </div>
            <div className="flex justify-between font-medium border-t mt-2 pt-2">
              <span>TOTAL ACTIVOS CORRIENTES</span>
              <span>{formatCurrency(num(data.total_current_assets))}</span>
            </div>
          </div>

          {/* Activos Fijos */}
          {fixedAssets.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Fijos</p>
              <div className="space-y-1 text-sm">
                {fixedAssets.map((acc, i) => (
                  <div key={str(acc.id) || i} className="flex justify-between">
                    <span className="text-gray-600">{str(acc.name)}</span>
                    <span>{formatCurrency(num(acc.net_value))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-medium border-t mt-2 pt-2">
                <span>TOTAL ACTIVOS FIJOS</span>
                <span>{formatCurrency(num(data.total_fixed_assets))}</span>
              </div>
            </div>
          )}

          {/* Total Activos */}
          <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-2 mt-4">
            <span>TOTAL ACTIVOS</span>
            <span className="text-blue-600">{formatCurrency(num(data.total_assets))}</span>
          </div>
        </div>

        {/* PASIVOS Y PATRIMONIO */}
        <div>
          <h5 className="font-bold text-gray-800 border-b-2 border-gray-800 pb-2 mb-3">PASIVOS</h5>

          {/* Pasivos Corrientes */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-600 mb-2">Corrientes</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Cuentas por Pagar ({num(currentLiabilities.accounts_payable_count)})</span>
                <span>{formatCurrency(num(currentLiabilities.accounts_payable))}</span>
              </div>
              {num(currentLiabilities.pending_expenses) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Gastos Pendientes ({num(currentLiabilities.pending_expenses_count)})</span>
                  <span>{formatCurrency(num(currentLiabilities.pending_expenses))}</span>
                </div>
              )}
              {shortTermDebt.map((acc, i) => (
                <div key={str(acc.id) || i} className="flex justify-between">
                  <span className="text-gray-600">{str(acc.name)}</span>
                  <span>{formatCurrency(num(acc.balance))}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-medium border-t mt-2 pt-2">
              <span>TOTAL PASIVOS CORRIENTES</span>
              <span>{formatCurrency(num(data.total_current_liabilities))}</span>
            </div>
          </div>

          {/* Pasivos Largo Plazo */}
          {longTermLiabilities.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-600 mb-2">Largo Plazo</p>
              <div className="space-y-1 text-sm">
                {longTermLiabilities.map((acc, i) => (
                  <div key={str(acc.id) || i} className="flex justify-between">
                    <span className="text-gray-600">{str(acc.name)}</span>
                    <span>{formatCurrency(num(acc.balance))}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-medium border-t mt-2 pt-2">
                <span>TOTAL PASIVOS LARGO PLAZO</span>
                <span>{formatCurrency(num(data.total_long_term_liabilities))}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between font-bold border-t pt-2">
            <span>TOTAL PASIVOS</span>
            <span className="text-red-600">{formatCurrency(num(data.total_liabilities))}</span>
          </div>

          {/* Patrimonio */}
          <h5 className="font-bold text-gray-800 border-b-2 border-gray-800 pb-2 mb-3 mt-6">PATRIMONIO</h5>
          <div className="space-y-1 text-sm mb-4">
            {num(equity.capital) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Capital</span>
                <span>{formatCurrency(num(equity.capital))}</span>
              </div>
            )}
            {num(equity.retained_earnings) !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Utilidades Retenidas</span>
                <span>{formatCurrency(num(equity.retained_earnings))}</span>
              </div>
            )}
            {num(equity.current_period_earnings) !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Utilidad del Ejercicio</span>
                <span className={num(equity.current_period_earnings) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(num(equity.current_period_earnings))}
                </span>
              </div>
            )}
            {num(equity.other_equity) !== 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Otros</span>
                <span>{formatCurrency(num(equity.other_equity))}</span>
              </div>
            )}
          </div>
          <div className="flex justify-between font-bold border-t pt-2">
            <span>TOTAL PATRIMONIO</span>
            <span className="text-green-600">{formatCurrency(num(data.total_equity))}</span>
          </div>

          {/* Total Pasivos + Patrimonio */}
          <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-2 mt-4">
            <span>PASIVOS + PATRIMONIO</span>
            <span className="text-blue-600">{formatCurrency(num(data.total_liabilities) + num(data.total_equity))}</span>
          </div>
        </div>
      </div>

      {/* Net Worth Summary */}
      <div className="mt-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-gray-800">PATRIMONIO NETO</span>
          <span className={`text-2xl font-bold ${num(data.net_worth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(num(data.net_worth))}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">Activos - Pasivos</p>
      </div>
    </>
  );
};

export default SnapshotBalanceSheet;
