/**
 * SnapshotComparison - Side-by-side comparison of two financial snapshots
 * Shows deltas and percentage changes with color-coded indicators
 */
import React from 'react';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type { FinancialSnapshotItem } from '../../services/globalAccountingService';

interface ComparisonMetric {
  key: string;
  label: string;
  format: 'currency' | 'percent';
  higherIsBetter: boolean;
  isHighlight?: boolean;
}

const ER_METRICS: ComparisonMetric[] = [
  { key: 'gross_revenue', label: 'Ventas Brutas', format: 'currency', higherIsBetter: true },
  { key: 'returns_discounts', label: 'Descuentos', format: 'currency', higherIsBetter: false },
  { key: 'net_revenue', label: 'Ingresos Netos', format: 'currency', higherIsBetter: true },
  { key: 'cost_of_goods_sold', label: 'Costo de Ventas', format: 'currency', higherIsBetter: false },
  { key: 'gross_profit', label: 'Utilidad Bruta', format: 'currency', higherIsBetter: true },
  { key: 'total_operating_expenses', label: 'Gastos Operacionales', format: 'currency', higherIsBetter: false },
  { key: 'operating_income', label: 'Utilidad Operacional', format: 'currency', higherIsBetter: true },
  { key: 'net_income', label: 'Utilidad Neta', format: 'currency', higherIsBetter: true, isHighlight: true },
  { key: 'gross_margin_percent', label: 'Margen Bruto', format: 'percent', higherIsBetter: true },
  { key: 'operating_margin_percent', label: 'Margen Operacional', format: 'percent', higherIsBetter: true },
  { key: 'net_margin_percent', label: 'Margen Neto', format: 'percent', higherIsBetter: true },
];

const BG_METRICS: ComparisonMetric[] = [
  { key: 'total_current_assets', label: 'Activos Corrientes', format: 'currency', higherIsBetter: true },
  { key: 'total_fixed_assets', label: 'Activos Fijos', format: 'currency', higherIsBetter: true },
  { key: 'total_assets', label: 'Total Activos', format: 'currency', higherIsBetter: true },
  { key: 'total_current_liabilities', label: 'Pasivos Corrientes', format: 'currency', higherIsBetter: false },
  { key: 'total_liabilities', label: 'Total Pasivos', format: 'currency', higherIsBetter: false },
  { key: 'total_equity', label: 'Total Patrimonio', format: 'currency', higherIsBetter: true },
  { key: 'net_worth', label: 'Patrimonio Neto', format: 'currency', higherIsBetter: true, isHighlight: true },
];

function getVal(data: Record<string, unknown>, key: string): number {
  const val = data[key];
  return typeof val === 'number' ? val : 0;
}

function computeDelta(a: number, b: number) {
  const absolute = b - a;
  const percent = a !== 0 ? ((b - a) / Math.abs(a)) * 100 : null;
  return { absolute, percent };
}

function getDeltaColor(delta: number, higherIsBetter: boolean): string {
  if (Math.abs(delta) < 0.01) return 'text-gray-500';
  const isImprovement = higherIsBetter ? delta > 0 : delta < 0;
  return isImprovement ? 'text-green-600' : 'text-red-600';
}

function formatVal(val: number, format: 'currency' | 'percent'): string {
  if (format === 'currency') return formatCurrency(val);
  return `${val.toFixed(1)}%`;
}

function formatDelta(val: number, format: 'currency' | 'percent'): string {
  const sign = val > 0 ? '+' : '';
  if (format === 'currency') return `${sign}${formatCurrency(val)}`;
  return `${sign}${val.toFixed(1)}pp`;
}

interface SnapshotComparisonProps {
  snapshotType: 'income_statement' | 'balance_sheet';
  snapshotA: { meta: FinancialSnapshotItem; data: Record<string, unknown> };
  snapshotB: { meta: FinancialSnapshotItem; data: Record<string, unknown> };
  onClose: () => void;
}

const SnapshotComparison: React.FC<SnapshotComparisonProps> = ({
  snapshotType,
  snapshotA,
  snapshotB,
  onClose,
}) => {
  // Sort: A = older, B = newer
  const [older, newer] = [snapshotA, snapshotB].sort(
    (a, b) => new Date(a.meta.snapshot_date).getTime() - new Date(b.meta.snapshot_date).getTime()
  );

  const metrics = snapshotType === 'income_statement' ? ER_METRICS : BG_METRICS;
  const title = snapshotType === 'income_statement' ? 'Estado de Resultados' : 'Balance General';

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });

  const olderLabel = older.meta.period_start && older.meta.period_end
    ? `${formatDate(older.meta.period_start)} - ${formatDate(older.meta.period_end)}`
    : formatDate(older.meta.snapshot_date);

  const newerLabel = newer.meta.period_start && newer.meta.period_end
    ? `${formatDate(newer.meta.period_start)} - ${formatDate(newer.meta.period_end)}`
    : formatDate(newer.meta.snapshot_date);

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex justify-between items-center mb-4">
        <h5 className="text-sm font-semibold text-gray-700">
          Comparacion: {title}
        </h5>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          title="Cerrar comparacion"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="text-left py-2 pr-4 text-gray-700 font-semibold">Metrica</th>
              <th className="text-right py-2 px-3 text-gray-600 font-medium min-w-[120px]">
                {olderLabel}
              </th>
              <th className="text-right py-2 px-3 text-gray-600 font-medium min-w-[120px]">
                {newerLabel}
              </th>
              <th className="text-right py-2 px-3 text-gray-600 font-medium min-w-[110px]">Cambio</th>
              <th className="text-right py-2 pl-3 text-gray-600 font-medium min-w-[80px]">%</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => {
              const valA = getVal(older.data, metric.key);
              const valB = getVal(newer.data, metric.key);
              const delta = computeDelta(valA, valB);
              const color = getDeltaColor(delta.absolute, metric.higherIsBetter);

              const rowBg = metric.isHighlight
                ? 'bg-gradient-to-r from-indigo-50 to-purple-50'
                : '';
              const rowFont = metric.isHighlight ? 'font-bold' : '';

              return (
                <tr key={metric.key} className={`border-b border-gray-100 ${rowBg}`}>
                  <td className={`py-2 pr-4 text-gray-700 ${rowFont}`}>
                    {metric.label}
                  </td>
                  <td className={`py-2 px-3 text-right text-gray-600 ${rowFont}`}>
                    {formatVal(valA, metric.format)}
                  </td>
                  <td className={`py-2 px-3 text-right text-gray-800 ${rowFont}`}>
                    {formatVal(valB, metric.format)}
                  </td>
                  <td className={`py-2 px-3 text-right ${color} ${rowFont}`}>
                    <span className="inline-flex items-center gap-1">
                      {Math.abs(delta.absolute) < 0.01 ? (
                        <Minus className="w-3 h-3" />
                      ) : delta.absolute > 0 ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {formatDelta(delta.absolute, metric.format)}
                    </span>
                  </td>
                  <td className={`py-2 pl-3 text-right ${color} ${rowFont}`}>
                    {delta.percent !== null ? `${delta.percent > 0 ? '+' : ''}${delta.percent.toFixed(1)}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs text-gray-400">
        Verde = mejora, Rojo = deterioro. Para gastos/pasivos, una reduccion es positiva.
      </div>
    </div>
  );
};

export default SnapshotComparison;
