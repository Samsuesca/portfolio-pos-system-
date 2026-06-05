/**
 * PayrollScenariosCompare - Compara 3 escenarios de nómina (N1 / N2 / N3)
 * lado a lado para soportar la presentación al equipo del miércoles 2026-05-20.
 *
 * Corre las 3 proyecciones (sin persistir) y muestra:
 * - Cards con la descripción y total año 1 de cada uno
 * - Tabla mes a mes: nómina | ingresos | profit operativo | caja acumulada
 * - Gráfico de líneas: caja acumulada por escenario por mes
 *
 * Los presets están en projectionPresets.ts (PAYROLL_SCENARIO_META).
 */
import { useCallback, useState } from 'react';
import { Play, AlertCircle, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  projectionService,
  type ProjectionMonth,
  type ProjectionRunResponse,
} from '../../../../services/projectionService';
import {
  PAYROLL_SCENARIO_META,
  buildPayrollScenarioAssumptions,
  type PayrollScenarioMeta,
} from './projectionPresets';

type ScenarioKey = 'N1' | 'N2' | 'N3';

const SCENARIO_COLORS: Record<ScenarioKey, string> = {
  N1: '#16a34a', // green-600 — conservador
  N2: '#2563eb', // blue-600 — base
  N3: '#dc2626', // red-600 — agresivo
};

const BADGE_STYLES: Record<PayrollScenarioMeta['badge'], string> = {
  conservador: 'bg-green-100 text-green-700 border-green-200',
  base: 'bg-blue-100 text-blue-700 border-blue-200',
  agresivo: 'bg-red-100 text-red-700 border-red-200',
};

function formatCOP(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}k`;
  }
  return `$${value.toFixed(0)}`;
}

function tooltipFormatter(value: unknown): string {
  return formatCOP(typeof value === 'number' ? value : Number(value ?? 0));
}

interface ScenarioRun {
  meta: PayrollScenarioMeta;
  result: ProjectionRunResponse;
}

export default function PayrollScenariosCompare(): JSX.Element {
  const [runs, setRuns] = useState<ScenarioRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAllScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const promises = PAYROLL_SCENARIO_META.map(async (meta) => {
        const assumptions = buildPayrollScenarioAssumptions(meta.key);
        const result = await projectionService.runProjection(assumptions, { persist: false });
        return { meta, result };
      });
      const results = await Promise.all(promises);
      setRuns(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al correr los escenarios');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-stone-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              Comparativo de escenarios de nómina
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-2xl">
              Corre los 3 escenarios (N1 conservador, N2 base, N3 formalización inmediata) y compara
              ingresos, nómina, profit operativo y caja acumulada mes a mes. Las cifras vienen de los
              presets en projectionPresets.ts. Para editarlos, ajusta los rangos en código y vuelve a correr.
            </p>
          </div>
          <button
            type="button"
            onClick={runAllScenarios}
            disabled={loading}
            className="bg-brand-600 hover:bg-brand-700 disabled:bg-stone-400 text-white text-sm font-medium px-4 py-2 rounded-md flex items-center gap-2 shrink-0"
          >
            <Play className="w-4 h-4" />
            {loading ? 'Calculando…' : 'Calcular los 3 escenarios'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Cards de cada escenario */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PAYROLL_SCENARIO_META.map((meta) => {
          const run = runs.find((r) => r.meta.key === meta.key);
          const totalPayroll = run?.result.months.reduce(
            (sum, m) => sum + Number(m.payroll),
            0,
          );
          const totalRevenue = run?.result.months.reduce(
            (sum, m) => sum + Number(m.revenue),
            0,
          );
          const endingCash = run?.result.summary.ending_cash != null
            ? Number(run.result.summary.ending_cash)
            : null;
          return (
            <div
              key={meta.key}
              className="bg-white border border-stone-200 rounded-lg p-4 space-y-2"
              style={{ borderTopWidth: 3, borderTopColor: SCENARIO_COLORS[meta.key] }}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-semibold text-stone-800 text-sm">{meta.label}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${BADGE_STYLES[meta.badge]}`}>
                  {meta.badge}
                </span>
              </div>
              <p className="text-xs text-stone-600 leading-relaxed">{meta.description}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-xs">
                <div>
                  <p className="text-stone-500">Fase 1</p>
                  <p className="font-medium text-stone-800">{meta.fase1TotalMonthly}</p>
                </div>
                <div>
                  <p className="text-stone-500">Fase 2</p>
                  <p className="font-medium text-stone-800">{meta.fase2TotalMonthly}</p>
                </div>
              </div>
              {run && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 text-xs">
                  <div>
                    <p className="text-stone-500">Nómina año 1</p>
                    <p className="font-semibold text-stone-800">{formatCOP(totalPayroll ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Ingresos año 1</p>
                    <p className="font-semibold text-stone-800">{formatCOP(totalRevenue ?? 0)}</p>
                  </div>
                  <div>
                    <p className="text-stone-500">Caja final</p>
                    <p
                      className="font-semibold"
                      style={{ color: (endingCash ?? 0) < 0 ? '#dc2626' : '#16a34a' }}
                    >
                      {endingCash != null ? formatCOP(endingCash) : '—'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {runs.length > 0 && (
        <>
          {/* Gráfico caja acumulada */}
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <h4 className="font-semibold text-stone-800 text-sm mb-3">
              Caja acumulada por escenario (mes a mes)
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={buildChartData(runs, 'cumulative_cash')}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatCOP(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={tooltipFormatter} />
                <Legend />
                {runs.map((r) => (
                  <Line
                    key={r.meta.key}
                    type="monotone"
                    dataKey={r.meta.key}
                    name={r.meta.label}
                    stroke={SCENARIO_COLORS[r.meta.key]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Tabla mes a mes */}
          <div className="bg-white border border-stone-200 rounded-lg p-4 overflow-x-auto">
            <h4 className="font-semibold text-stone-800 text-sm mb-3">
              Detalle mensual (nómina · ingresos · profit operativo · caja acumulada)
            </h4>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="text-left py-2 px-2">Mes</th>
                  {runs.map((r) => (
                    <th key={r.meta.key} colSpan={4} className="text-center py-2 px-2" style={{ color: SCENARIO_COLORS[r.meta.key] }}>
                      {r.meta.key}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-stone-200 text-stone-400 text-[10px]">
                  <th></th>
                  {runs.flatMap((r) => [
                    <th key={`${r.meta.key}-nom`} className="text-right px-1">Nómina</th>,
                    <th key={`${r.meta.key}-rev`} className="text-right px-1">Ingresos</th>,
                    <th key={`${r.meta.key}-prof`} className="text-right px-1">Profit op</th>,
                    <th key={`${r.meta.key}-cash`} className="text-right px-1">Caja</th>,
                  ])}
                </tr>
              </thead>
              <tbody>
                {(runs[0]?.result.months ?? []).map((m, idx) => (
                  <tr key={idx} className="border-b border-stone-100">
                    <td className="py-1.5 px-2 text-stone-700">{m.period_label}</td>
                    {runs.flatMap((r) => {
                      const mm = r.result.months[idx];
                      const profit = Number(mm?.operating_profit ?? 0);
                      const cash = Number(mm?.cumulative_cash ?? 0);
                      return [
                        <td key={`${r.meta.key}-nom-${idx}`} className="text-right px-1 text-stone-700">{formatCOP(Number(mm?.payroll ?? 0))}</td>,
                        <td key={`${r.meta.key}-rev-${idx}`} className="text-right px-1 text-stone-700">{formatCOP(Number(mm?.revenue ?? 0))}</td>,
                        <td key={`${r.meta.key}-prof-${idx}`} className="text-right px-1" style={{ color: profit < 0 ? '#dc2626' : '#16a34a' }}>
                          {formatCOP(profit)}
                        </td>,
                        <td key={`${r.meta.key}-cash-${idx}`} className="text-right px-1 font-medium" style={{ color: cash < 0 ? '#dc2626' : '#1f2937' }}>
                          {formatCOP(cash)}
                        </td>,
                      ];
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function buildChartData(
  runs: ScenarioRun[],
  field: keyof ProjectionMonth,
): Array<Record<string, string | number>> {
  const months = runs[0]?.result.months ?? [];
  return months.map((m, idx) => {
    const row: Record<string, string | number> = { label: m.period_label };
    for (const r of runs) {
      const cell = r.result.months[idx]?.[field];
      row[r.meta.key] = typeof cell === 'number' ? cell : Number(cell ?? 0);
    }
    return row;
  });
}
