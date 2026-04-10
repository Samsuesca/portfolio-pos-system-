/**
 * Module 7: Executive Summary - Print-optimized one-page financial overview
 */
import { FileText, Printer, TrendingUp, TrendingDown, Minus, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import type { ExecutiveSummaryResponse } from '../../../services/financialModelService';

interface Props {
  data: ExecutiveSummaryResponse | null;
}

function formatMoney(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 0) return `-$${Math.abs(rounded).toLocaleString('es-CO')}`;
  return `$${rounded.toLocaleString('es-CO')}`;
}

function ChangeIndicator({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-gray-400 text-xs">N/A</span>;
  const rounded = Number(value).toFixed(1);
  if (Number(value) > 0) return <span className="text-green-600 text-xs flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{rounded}%</span>;
  if (Number(value) < 0) return <span className="text-red-600 text-xs flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{rounded}%</span>;
  return <span className="text-gray-400 text-xs flex items-center gap-0.5"><Minus className="w-3 h-3" />0%</span>;
}

const KPI_STATUS_DOT = {
  good: 'bg-green-500',
  caution: 'bg-yellow-500',
  critical: 'bg-red-500',
  neutral: 'bg-gray-400',
};

const ALERT_ICON = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const ALERT_COLOR = {
  critical: 'text-red-600',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
};

export default function ExecutiveSummaryPanel({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No hay datos para el resumen ejecutivo</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <h3 className="text-lg font-semibold text-gray-800">Resumen Ejecutivo</h3>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimir / PDF
        </button>
      </div>

      {/* Printable content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 print:shadow-none print:border-0 print:p-0">
        {/* Header */}
        <div className="text-center mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Uniformes Consuelo Ríos</h2>
          <p className="text-gray-500 text-sm mt-1">Resumen Financiero — {data.period_label}</p>
        </div>

        {/* Key figures */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs text-blue-600 uppercase font-medium">Ingresos</p>
            <p className="text-lg font-bold text-blue-800 mt-1">{formatMoney(data.revenue)}</p>
            <ChangeIndicator value={data.revenue_vs_previous} />
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <p className="text-xs text-red-600 uppercase font-medium">Gastos</p>
            <p className="text-lg font-bold text-red-800 mt-1">{formatMoney(data.expenses)}</p>
            <ChangeIndicator value={data.expenses_vs_previous} />
          </div>
          <div className={`rounded-lg p-4 ${Number(data.net_profit) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-xs uppercase font-medium ${Number(data.net_profit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Utilidad Neta
            </p>
            <p className={`text-lg font-bold mt-1 ${Number(data.net_profit) >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {formatMoney(data.net_profit)}
            </p>
            <ChangeIndicator value={data.profit_vs_previous} />
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-xs text-purple-600 uppercase font-medium">Posición de Caja</p>
            <p className="text-lg font-bold text-purple-800 mt-1">{formatMoney(data.cash_position)}</p>
          </div>
        </div>

        {/* Top schools and categories */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top 3 schools */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Top 3 Colegios por Ingresos</h4>
            <div className="space-y-2">
              {data.top_schools.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800">{s.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800">{formatMoney(s.amount)}</span>
                    <span className="text-xs text-gray-500 ml-2">({Number(s.percentage).toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
              {data.top_schools.length === 0 && (
                <p className="text-sm text-gray-400">Sin datos</p>
              )}
            </div>
          </div>

          {/* Top 3 expense categories */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Top 3 Categorías de Gasto</h4>
            <div className="space-y-2">
              {data.top_expense_categories.map((c, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                    <span className="text-sm font-medium text-gray-800">{c.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-gray-800">{formatMoney(c.amount)}</span>
                    <span className="text-xs text-gray-500 ml-2">({Number(c.percentage).toFixed(1)}%)</span>
                  </div>
                </div>
              ))}
              {data.top_expense_categories.length === 0 && (
                <p className="text-sm text-gray-400">Sin datos</p>
              )}
            </div>
          </div>
        </div>

        {/* KPI Snapshot */}
        {data.kpi_snapshot.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Indicadores Clave</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {data.kpi_snapshot.map((kpi) => (
                <div key={kpi.key} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <div className={`w-2 h-2 rounded-full ${KPI_STATUS_DOT[kpi.status] || KPI_STATUS_DOT.neutral}`} />
                    <span className="text-xs text-gray-500">{kpi.label}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-800">{kpi.formatted_value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active alerts */}
        {data.active_alerts.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Alertas Activas ({data.active_alerts.length})</h4>
            <div className="space-y-2">
              {data.active_alerts.slice(0, 5).map((alert, i) => {
                const Icon = ALERT_ICON[alert.severity] || Info;
                const color = ALERT_COLOR[alert.severity] || 'text-gray-600';
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Icon className={`w-4 h-4 ${color} shrink-0`} />
                    <span className="text-gray-700">{alert.title}: {alert.message.substring(0, 80)}{alert.message.length > 80 ? '...' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Forecast summary */}
        {data.forecast_summary && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-1">Proyección (3 meses)</h4>
            <p className="text-sm text-gray-600">{data.forecast_summary}</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-6 pt-4 border-t border-gray-200">
          Generado: {new Date(data.generated_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .bg-white.rounded-xl.shadow-sm { visibility: visible !important; position: absolute; left: 0; top: 0; width: 100%; }
          .bg-white.rounded-xl.shadow-sm * { visibility: visible !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
