/**
 * Module 3: Trend Analysis
 */
import { TrendingUp, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TrendAnalysisResponse } from '../../../services/financialModelService';

interface Props {
  data: TrendAnalysisResponse | null;
}

const METRIC_COLORS: Record<string, string> = {
  revenue: '#3b82f6',
  expenses: '#ef4444',
  profit: '#10b981',
  cash_position: '#8b5cf6',
};

const METRIC_LABELS: Record<string, string> = {
  revenue: 'Ingresos',
  expenses: 'Gastos',
  profit: 'Utilidad',
  cash_position: 'Posición de Caja',
};

function formatMoney(value: number): string {
  const rounded = Math.round(Number(value));
  if (Math.abs(rounded) >= 1000000) return `$${(rounded / 1000000).toFixed(1)}M`;
  if (Math.abs(rounded) >= 1000) return `$${(rounded / 1000).toFixed(0)}K`;
  return `$${rounded.toLocaleString('es-CO')}`;
}

export default function TrendsPanel({ data }: Props) {
  if (!data || data.series.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No hay datos de tendencias disponibles</p>
      </div>
    );
  }

  // Build combined chart data
  const periods = data.series[0]?.data.map(d => d.period_label) || [];
  const chartData = periods.map((label, i) => {
    const point: Record<string, any> = { name: label };
    for (const series of data.series) {
      point[series.metric] = Number(series.data[i]?.value || 0);
    }
    return point;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Análisis de Tendencias</h3>
        <span className="text-xs text-gray-400">
          {data.start_date} a {data.end_date}
        </span>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v: any) => formatMoney(Number(v))} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: any) => `$${Math.round(Number(value)).toLocaleString('es-CO')}`} />
            <Legend />
            {data.series.map((series) => (
              <Line
                key={series.metric}
                type="monotone"
                dataKey={series.metric}
                name={METRIC_LABELS[series.metric] || series.label}
                stroke={METRIC_COLORS[series.metric] || '#6b7280'}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Growth rates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.series.map((series) => (
          <div key={series.metric} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{METRIC_LABELS[series.metric] || series.label}</p>
            <p className="text-lg font-bold text-gray-800 mt-1">
              {series.data.length > 0
                ? `$${Math.round(Number(series.data[series.data.length - 1].value)).toLocaleString('es-CO')}`
                : '-'}
            </p>
            {series.growth_rate !== null && (
              <p className={`text-sm mt-1 ${Number(series.growth_rate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Number(series.growth_rate) >= 0 ? '+' : ''}{Number(series.growth_rate).toFixed(1)}% crecimiento
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Anomalies */}
      {data.anomalies.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <h4 className="font-medium text-yellow-800">Anomalías Detectadas</h4>
          </div>
          <ul className="space-y-1">
            {data.anomalies.map((a, i) => (
              <li key={i} className="text-sm text-yellow-700">
                <strong>{METRIC_LABELS[a.metric] || a.metric}</strong> en {a.period}:
                {a.direction === 'spike' ? ' pico' : ' caída'} inusual
                (z-score: {a.z_score})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
