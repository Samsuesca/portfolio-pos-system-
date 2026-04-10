/**
 * Module 5: Advanced Cash Flow Forecast
 */
import { LineChart as LineChartIcon, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import type { CashForecastResponse } from '../../../services/financialModelService';

interface Props {
  data: CashForecastResponse | null;
}

function formatMoney(value: number): string {
  const rounded = Math.round(value);
  if (Math.abs(rounded) >= 1000000) return `$${(rounded / 1000000).toFixed(1)}M`;
  return `$${rounded.toLocaleString('es-CO')}`;
}

const SCENARIO_COLORS = {
  optimistic: '#10b981',
  expected: '#3b82f6',
  pessimistic: '#ef4444',
};

export default function CashForecastPanel({ data }: Props) {
  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <LineChartIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No hay datos de proyección disponibles</p>
      </div>
    );
  }

  // Build chart data from all scenarios
  const expected = data.scenarios.find(s => s.name === 'expected');
  const optimistic = data.scenarios.find(s => s.name === 'optimistic');
  const pessimistic = data.scenarios.find(s => s.name === 'pessimistic');

  const chartData = (expected?.periods || []).map((period, i) => ({
    name: period.period_label,
    Esperado: Number(period.projected_balance),
    Optimista: optimistic ? Number(optimistic.periods[i]?.projected_balance || 0) : 0,
    Pesimista: pessimistic ? Number(pessimistic.periods[i]?.projected_balance || 0) : 0,
  }));

  const runway = Number(data.runway_months);
  const runwayLabel = runway >= 999
    ? 'Indefinido (rentable)'
    : `${runway.toFixed(1)} meses`;

  const runwayStatus = runway >= 999
    ? 'good'
    : runway >= 6
    ? 'good'
    : runway >= 2
    ? 'caution'
    : 'critical';

  const runwayColors = {
    good: 'bg-green-50 border-green-200 text-green-800',
    caution: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    critical: 'bg-red-50 border-red-200 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Proyección de Flujo de Caja</h3>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo Actual</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{formatMoney(data.current_balance)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${runwayColors[runwayStatus]}`}>
          <p className="text-xs uppercase tracking-wide opacity-75">Runway</p>
          <p className="text-xl font-bold mt-1">{runwayLabel}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Umbral Mínimo</p>
          <p className="text-xl font-bold text-gray-800 mt-1">{formatMoney(data.min_threshold)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h4 className="text-sm font-medium text-gray-600 mb-4">Proyección por Escenario</h4>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={formatMoney} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
            <Legend />
            <ReferenceLine
              y={Number(data.min_threshold)}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: 'Umbral mínimo', position: 'insideTopRight', fontSize: 11, fill: '#ef4444' }}
            />
            <Area
              type="monotone"
              dataKey="Optimista"
              stroke={SCENARIO_COLORS.optimistic}
              fill={SCENARIO_COLORS.optimistic}
              fillOpacity={0.1}
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="Esperado"
              stroke={SCENARIO_COLORS.expected}
              fill={SCENARIO_COLORS.expected}
              fillOpacity={0.15}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="Pesimista"
              stroke={SCENARIO_COLORS.pessimistic}
              fill={SCENARIO_COLORS.pessimistic}
              fillOpacity={0.1}
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed table */}
      {expected && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Período</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Ingresos</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Gastos</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Neto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {expected.periods.map((p) => {
                  const belowThreshold = Number(p.projected_balance) < Number(data.min_threshold);
                  return (
                    <tr key={p.period} className={`border-b border-gray-100 ${belowThreshold ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {belowThreshold && <AlertTriangle className="w-4 h-4 text-red-500 inline mr-1" />}
                        {p.period_label}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700">{formatMoney(p.projected_income)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{formatMoney(p.projected_expenses)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${Number(p.projected_net) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {formatMoney(p.projected_net)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${belowThreshold ? 'text-red-700' : 'text-gray-800'}`}>
                        {formatMoney(p.projected_balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
