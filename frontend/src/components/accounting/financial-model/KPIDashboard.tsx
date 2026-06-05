/**
 * Module 1: KPI Dashboard - Financial health indicators with sparklines.
 *
 * Cuando un KPI no se puede calcular (denominador cero, datos faltantes),
 * el backend lo devuelve con `value: null`, `formatted_value: "—"` y
 * `tooltip_unavailable` explicando la causa.
 */
import { TrendingUp, TrendingDown, Minus, Info, BarChart3, AlertTriangle } from 'lucide-react';
import type { KPIDashboardResponse, KPIValue } from '../../../services/financialModelService';

interface Props {
  data: KPIDashboardResponse | null;
}

const STATUS_COLORS = {
  good: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
  caution: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', dot: 'bg-yellow-500' },
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500' },
  neutral: { bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-700', dot: 'bg-stone-400' },
};

function MiniSparkline({ data, status }: { data: number[]; status: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 30;
  const w = 80;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const color = status === 'good' ? '#22c55e' : status === 'caution' ? '#eab308' : status === 'critical' ? '#ef4444' : '#9ca3af';

  return (
    <svg width={w} height={h} className="mt-1">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function KPICard({ kpi }: { kpi: KPIValue }) {
  const isUnavailable = kpi.value === null;
  const colors = STATUS_COLORS[kpi.status] || STATUS_COLORS.neutral;
  const trend = kpi.trend;
  const lastTwo = trend.length >= 2 ? [trend[trend.length - 2], trend[trend.length - 1]] : null;
  const trendDir = lastTwo ? (lastTwo[1] > lastTwo[0] ? 'up' : lastTwo[1] < lastTwo[0] ? 'down' : 'flat') : 'flat';

  return (
    <div className={`${colors.bg} ${colors.border} border rounded-xl p-4 relative group`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide truncate">{kpi.label}</p>
          </div>
          <p
            className={`text-xl font-bold mt-1 ${
              isUnavailable ? 'text-stone-400' : colors.text
            }`}
          >
            {kpi.formatted_value}
          </p>
        </div>
        <div className="flex flex-col items-end">
          {isUnavailable ? (
            <AlertTriangle className="w-4 h-4 text-stone-300" aria-label="Sin datos suficientes" />
          ) : (
            <>
              {trendDir === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
              {trendDir === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
              {trendDir === 'flat' && <Minus className="w-4 h-4 text-stone-400" />}
              <MiniSparkline data={trend} status={kpi.status} />
            </>
          )}
        </div>
      </div>

      {/* Tooltip — muestra contexto general + razón de no disponibilidad */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-64">
        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <Info className="w-3 h-3 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p>{kpi.tooltip}</p>
              {isUnavailable && kpi.tooltip_unavailable && (
                <p className="text-yellow-300 text-[11px] border-t border-gray-700 pt-1 mt-1">
                  {kpi.tooltip_unavailable}
                </p>
              )}
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      </div>
    </div>
  );
}

export default function KPIDashboard({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
        <BarChart3 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-500">No hay datos de KPIs disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-stone-800">Indicadores Clave de Rendimiento</h3>
          {data.period_label && (
            <p className="text-xs text-stone-500 mt-0.5">{data.period_label}</p>
          )}
        </div>
        <span className="text-xs text-stone-400 shrink-0">{data.period}</span>
      </div>
      {data.period_warning && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <AlertTriangle className="w-4 h-4 text-yellow-700 mt-0.5 shrink-0" />
          <p className="text-xs text-yellow-800">{data.period_warning}</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {data.kpis.map((kpi) => (
          <KPICard key={kpi.key} kpi={kpi} />
        ))}
      </div>
    </div>
  );
}
