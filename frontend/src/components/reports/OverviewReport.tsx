/**
 * OverviewReport — Resumen 360 tab.
 *
 * Fase 3 frontend del plan Reports Coverage Expansion. Executive view
 * that puts the three revenue streams (Ventas / Encargos / Arreglos)
 * side-by-side so the business owner can answer their top question
 * — "how is each line of business doing this month" — in one screen.
 *
 * Composition:
 *   - 3 stream cards across the top (one column per stream)
 *   - Per-school breakdown table underneath, comparing Ventas vs
 *     Encargos revenue per school + totals row that adds Arreglos
 *     (alterations not scoped to schools today)
 *   - A small "basis" toggle to switch between accrual (P&L) and cash
 *     (caja) — answers different questions
 *
 * Cost columns hidden when the caller lacks `reports.cost_visibility`.
 */
import React from 'react';
import {
  Loader2, AlertCircle, ShoppingBag, ShoppingCart, Scissors,
  TrendingUp, DollarSign, Building2, Info
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';
import type {
  StreamSummary,
  StreamBreakdown,
  StreamsBreakdownBySchool,
  RevenueBasis,
} from '../../services/reportsService';

interface OverviewReportProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  summary: StreamSummary | null;
  bySchool: StreamsBreakdownBySchool | null;
  basis: RevenueBasis;
  onBasisChange: (basis: RevenueBasis) => void;
  dateRangeLabel: string;
}

const STREAM_META = {
  sales: {
    label: 'Ventas',
    description: 'Cliente entra, paga, se va',
    icon: ShoppingBag,
    gradient: 'from-blue-600 to-blue-700',
    textTone: 'text-blue-100',
    border: 'border-blue-200',
  },
  orders: {
    label: 'Encargos',
    description: 'Producción a la medida',
    icon: ShoppingCart,
    gradient: 'from-amber-600 to-amber-700',
    textTone: 'text-amber-100',
    border: 'border-amber-200',
  },
  alterations: {
    label: 'Arreglos',
    description: 'Servicio de modificación',
    icon: Scissors,
    gradient: 'from-orange-500 to-orange-600',
    textTone: 'text-orange-100',
    border: 'border-orange-200',
  },
  b2b_contracts: {
    label: 'B2B Contratos',
    description: 'Próximamente',
    icon: Building2,
    gradient: 'from-stone-400 to-stone-500',
    textTone: 'text-stone-100',
    border: 'border-stone-200',
  },
  saas: {
    label: 'SaaS',
    description: 'Próximamente',
    icon: Building2,
    gradient: 'from-stone-400 to-stone-500',
    textTone: 'text-stone-100',
    border: 'border-stone-200',
  },
} as const;

const OverviewReport: React.FC<OverviewReportProps> = ({
  loading,
  error,
  onRetry,
  summary,
  bySchool,
  basis,
  onBasisChange,
  dateRangeLabel,
}) => {
  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        <span className="ml-3 text-stone-600">Cargando resumen del periodo...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">
              Error al cargar el resumen
            </h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={onRetry}
              className="mt-3 text-sm text-red-700 hover:text-red-800 underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine which streams to render. Always show the 3 active ones;
  // hide B2B/SaaS unless the backend explicitly returned data for them
  // (the stub returns 0+note, so we show them with a "Próximamente" badge).
  const visibleStreams: Array<{
    id: keyof typeof STREAM_META;
    breakdown: StreamBreakdown;
  }> = [];
  const activeIds: (keyof typeof STREAM_META)[] = ['sales', 'orders', 'alterations'];
  for (const id of activeIds) {
    const bd = summary?.streams[id];
    if (bd) visibleStreams.push({ id, breakdown: bd });
  }

  // Show B2B as a placeholder card only if the backend returned it
  const b2b = summary?.streams.b2b_contracts;
  const showB2BPlaceholder = b2b && b2b.note === 'not_yet_implemented';

  const canViewMargin = summary
    ? Object.values(summary.streams).some(
        (s) => s && s.gross_margin_pct !== null && s.gross_margin_pct !== undefined,
      )
    : false;

  return (
    <>
      {/* Basis toggle + period label */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-600" />
            <span className="text-sm font-medium text-stone-700">Periodo:</span>
            <span className="text-sm text-stone-600">{dateRangeLabel || 'Todo el tiempo'}</span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-sm text-stone-600">Base de reconocimiento:</span>
            <div className="inline-flex rounded-lg border border-stone-200 overflow-hidden">
              <button
                onClick={() => onBasisChange('accrual')}
                className={`px-3 py-1.5 text-xs font-medium ${
                  basis === 'accrual'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
                title="Revenue al momento de la entrega (P&L)"
              >
                Devengado
              </button>
              <button
                onClick={() => onBasisChange('cash')}
                className={`px-3 py-1.5 text-xs font-medium ${
                  basis === 'cash'
                    ? 'bg-brand-500 text-white'
                    : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}
                title="Revenue al momento del pago (caja)"
              >
                Caja
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stream cards */}
      <div className={`grid grid-cols-1 md:grid-cols-${
        showB2BPlaceholder ? '4' : '3'
      } gap-4 mb-6`}>
        {visibleStreams.map(({ id, breakdown }) => (
          <StreamCard
            key={id}
            streamId={id}
            breakdown={breakdown}
            canViewMargin={canViewMargin}
          />
        ))}
        {showB2BPlaceholder && b2b && (
          <StreamCard
            streamId="b2b_contracts"
            breakdown={b2b}
            canViewMargin={false}
          />
        )}
      </div>

      {/* Totals strip */}
      {summary && (
        <div className="bg-stone-900 rounded-lg p-4 mb-6 text-white flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-400" />
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide">
                Ingresos totales del periodo
              </p>
              <p className="text-3xl font-bold">{formatCurrency(summary.totals.revenue)}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-stone-400 text-xs">Transacciones</p>
              <p className="font-semibold text-lg">{summary.totals.count.toLocaleString('es-CO')}</p>
            </div>
            {summary.totals.cogs !== null && (
              <>
                <div>
                  <p className="text-stone-400 text-xs">COGS</p>
                  <p className="font-semibold text-lg">{formatCurrency(summary.totals.cogs)}</p>
                </div>
                <div>
                  <p className="text-stone-400 text-xs">Margen bruto</p>
                  <p className="font-semibold text-lg text-emerald-400">
                    {summary.totals.gross_margin_pct?.toFixed(1)}%
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* By-school breakdown table */}
      {bySchool && bySchool.rows.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-stone-200">
            <h2 className="text-lg font-semibold text-stone-800 flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-brand-600" />
              Ingresos por colegio
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              {dateRangeLabel || 'Todo el tiempo'} — Ventas y Encargos por colegio. Arreglos suma al total
              global (el taller no se segmenta por colegio).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-stone-500 uppercase">
                    Colegio
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-blue-600 uppercase">
                    Ventas
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-amber-600 uppercase">
                    Encargos
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-stone-500 uppercase">
                    % del total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-100">
                {bySchool.rows.map((row, index) => {
                  const pct = bySchool.totals.total_revenue > 0
                    ? (row.total_revenue / bySchool.totals.total_revenue) * 100
                    : 0;
                  return (
                    <tr key={row.school_id} className="hover:bg-stone-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <span className="w-6 h-6 flex items-center justify-center bg-brand-100 text-brand-600 rounded-full text-xs font-bold mr-3">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-stone-900">
                            {row.school_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-blue-700">
                        {formatCurrency(row.sales_revenue)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-amber-700">
                        {formatCurrency(row.orders_revenue)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-stone-900">
                        {formatCurrency(row.total_revenue)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-2 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-stone-500 w-10">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-stone-50 font-semibold">
                <tr>
                  <td className="px-6 py-4 text-sm text-stone-900">Total + Arreglos</td>
                  <td className="px-6 py-4 text-right text-sm text-blue-700">
                    {formatCurrency(bySchool.totals.sales_revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-amber-700">
                    {formatCurrency(bySchool.totals.orders_revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-stone-900">
                    {formatCurrency(bySchool.totals.total_revenue)}
                  </td>
                  <td className="px-6 py-4 text-right text-sm text-stone-500">
                    Incluye Arreglos: {formatCurrency(bySchool.totals.alterations_revenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="px-6 py-3 bg-stone-50 border-t border-stone-100 flex items-start gap-2 text-xs text-stone-600">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Arreglos no se segmentan por colegio</strong> porque el taller opera de forma
              centralizada. El total de Arreglos del periodo se suma al gran total pero no aparece
              en las filas por colegio.
            </span>
          </div>
        </div>
      )}
    </>
  );
};

// ---------- Helpers ----------

interface StreamCardProps {
  streamId: keyof typeof STREAM_META;
  breakdown: StreamBreakdown;
  canViewMargin: boolean;
}

const StreamCard: React.FC<StreamCardProps> = ({ streamId, breakdown, canViewMargin }) => {
  const meta = STREAM_META[streamId];
  const Icon = meta.icon;
  const isPlaceholder = breakdown.note === 'not_yet_implemented';

  return (
    <div
      className={`rounded-lg p-5 text-white bg-gradient-to-br ${meta.gradient} ${
        isPlaceholder ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5" />
          <span className="text-sm font-medium">{meta.label}</span>
        </div>
        {isPlaceholder && (
          <span className="text-[10px] uppercase bg-white/20 px-2 py-0.5 rounded">
            Próximamente
          </span>
        )}
      </div>
      <p className={`text-3xl font-bold ${meta.textTone}`}>
        {formatCurrency(breakdown.revenue)}
      </p>
      <p className={`text-xs mt-1 ${meta.textTone}`}>{meta.description}</p>
      <div className={`mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-sm ${meta.textTone}`}>
        <span>
          {breakdown.count.toLocaleString('es-CO')} transacc.
        </span>
        {canViewMargin && breakdown.gross_margin_pct !== null && (
          <span>
            Margen: <strong>{breakdown.gross_margin_pct.toFixed(1)}%</strong>
          </span>
        )}
      </div>
    </div>
  );
};

export default OverviewReport;
