/**
 * ProjectionResults - Render del resultado de una proyección.
 *
 * Layout:
 *  - Cards de resumen (totales + márgenes + breakeven + caja final)
 *  - Gráficos: Revenue × Net Profit (área apilada) + Cumulative cash + OpEx breakdown
 *  - Tabla mes a mes con flags
 */
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Wallet, Activity, Target, DollarSign, Percent, Users,
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatting';
import type { ProjectionRunResponse, ProjectionMonth, ProjectionSummary } from '../../../../services/projectionService';

interface Props {
  result: ProjectionRunResponse;
}

interface SummaryCardProps {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'caution' | 'critical' | 'neutral';
}

function SummaryCard({ icon: Icon, label, value, hint, tone = 'neutral' }: SummaryCardProps) {
  const colors = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    caution: 'border-yellow-200 bg-yellow-50 text-yellow-800',
    critical: 'border-red-200 bg-red-50 text-red-800',
    neutral: 'border-stone-200 bg-white text-stone-800',
  }[tone];
  return (
    <div className={`p-3 border rounded-lg ${colors}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-lg font-semibold mt-1">{value}</div>
      {hint && <div className="text-[11px] opacity-70 mt-0.5">{hint}</div>}
    </div>
  );
}

function summaryTone(summary: ProjectionSummary): {
  netProfit: SummaryCardProps['tone'];
  endingCash: SummaryCardProps['tone'];
  monthsNegative: SummaryCardProps['tone'];
} {
  return {
    netProfit: summary.total_net_profit > 0 ? 'good' : 'critical',
    endingCash: summary.ending_cash > 0 ? 'good' : 'critical',
    monthsNegative: summary.months_cash_negative === 0
      ? 'good' : summary.months_cash_negative <= 2 ? 'caution' : 'critical',
  };
}

function buildPLChartData(months: ProjectionMonth[]) {
  return months.map((m) => ({
    period: `${m.period_label.slice(0, 3)} ${String(m.year).slice(2)}`,
    revenue: Math.round(m.revenue),
    cogs: Math.round(m.cogs),
    opex: Math.round(m.total_opex),
    net_profit: Math.round(m.net_profit),
  }));
}

function buildCashChartData(months: ProjectionMonth[]) {
  return months.map((m) => ({
    period: `${m.period_label.slice(0, 3)} ${String(m.year).slice(2)}`,
    cumulative_cash: Math.round(m.cumulative_cash),
    net_cash_flow: Math.round(m.net_cash_flow),
  }));
}

function buildOpExChartData(months: ProjectionMonth[]) {
  return months.map((m) => ({
    period: `${m.period_label.slice(0, 3)} ${String(m.year).slice(2)}`,
    fixed: Math.round(m.fixed_costs),
    payroll: Math.round(m.payroll),
    formalization_one_time: Math.round(m.formalization_cost_one_time),
    formalization_recurring: Math.round(m.formalization_cost_recurring),
  }));
}

function tooltipFormatter(value: unknown): string {
  return formatCurrency(typeof value === 'number' ? value : 0);
}

export default function ProjectionResults({ result }: Props) {
  const { months, summary, name, assumptions } = result;
  const tones = summaryTone(summary);
  const plData = buildPLChartData(months);
  const cashData = buildCashChartData(months);
  const opexData = buildOpExChartData(months);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-semibold text-stone-800">{name}</h3>
            <p className="text-sm text-stone-500">
              {assumptions.months} meses · inicia {assumptions.start_month}/{assumptions.start_year}
              {assumptions.formalization_layer && ` · Escenario ${assumptions.formalization_layer.scenario_label}`}
            </p>
          </div>
          {result.id && (
            <span className="text-xs text-stone-400 font-mono">ID: {result.id.slice(0, 8)}…</span>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          icon={DollarSign} label="Ingresos totales" value={formatCurrency(summary.total_revenue)}
        />
        <SummaryCard
          icon={Activity} label="Utilidad neta total"
          value={formatCurrency(summary.total_net_profit)}
          hint={`Margen ${summary.avg_net_margin_pct.toFixed(1)}%`}
          tone={tones.netProfit}
        />
        <SummaryCard
          icon={Wallet} label="Caja final"
          value={formatCurrency(summary.ending_cash)}
          hint={`Mín. caja: ${formatCurrency(summary.min_cash)}`}
          tone={tones.endingCash}
        />
        <SummaryCard
          icon={AlertTriangle} label="Meses con caja negativa"
          value={String(summary.months_cash_negative)}
          hint={summary.months_cash_negative > 0 ? 'Revisar capa de costos' : 'Sin déficit'}
          tone={tones.monthsNegative}
        />
        <SummaryCard
          icon={Percent} label="Margen bruto promedio"
          value={`${summary.avg_gross_margin_pct.toFixed(1)}%`}
        />
        <SummaryCard
          icon={Target} label="Breakeven mensual promedio"
          value={formatCurrency(summary.breakeven_revenue_monthly_avg)}
          hint="Ingresos requeridos para op profit = 0"
        />
        <SummaryCard
          icon={Activity} label="OpEx total" value={formatCurrency(summary.total_opex)}
        />
        <SummaryCard
          icon={Users} label="Headcount fin de período"
          value={String(months[months.length - 1]?.headcount ?? 0)}
        />
      </div>

      {/* Formalization summary */}
      {(summary.total_formalization_one_time > 0 || summary.total_formalization_recurring > 0) && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-medium text-purple-900 mb-2">Capa de formalización</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-purple-600">Costos one-time:</span>
              <p className="font-semibold">{formatCurrency(summary.total_formalization_one_time)}</p>
            </div>
            <div>
              <span className="text-purple-600">Costos recurrentes:</span>
              <p className="font-semibold">{formatCurrency(summary.total_formalization_recurring)}</p>
            </div>
            <div>
              <span className="text-purple-600">Total formalización:</span>
              <p className="font-semibold">
                {formatCurrency(summary.total_formalization_one_time + summary.total_formalization_recurring)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* P&L chart */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h4 className="font-medium text-stone-800 mb-3">Ingresos vs costos vs utilidad neta</h4>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={plData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Area type="monotone" dataKey="revenue" name="Ingresos" stackId="1" fill="#10b981" stroke="#059669" fillOpacity={0.3} />
            <Area type="monotone" dataKey="cogs" name="COGS" stackId="2" fill="#f59e0b" stroke="#d97706" fillOpacity={0.3} />
            <Area type="monotone" dataKey="opex" name="OpEx" stackId="3" fill="#ef4444" stroke="#dc2626" fillOpacity={0.3} />
            <Line type="monotone" dataKey="net_profit" name="Utilidad neta" stroke="#3b82f6" strokeWidth={2} dot />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative cash */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h4 className="font-medium text-stone-800 mb-3">Caja acumulada</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={cashData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Cero caja', position: 'right', fill: '#dc2626', fontSize: 11 }} />
            <Line type="monotone" dataKey="cumulative_cash" name="Caja acumulada" stroke="#0ea5e9" strokeWidth={2.5} dot />
            <Line type="monotone" dataKey="net_cash_flow" name="Flujo neto del mes" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* OpEx breakdown */}
      <div className="bg-white border border-stone-200 rounded-lg p-4">
        <h4 className="font-medium text-stone-800 mb-3">Composición de OpEx</h4>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={opexData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
            <Bar dataKey="fixed" name="Costos fijos" stackId="opex" fill="#94a3b8" />
            <Bar dataKey="payroll" name="Nómina" stackId="opex" fill="#fb923c" />
            <Bar dataKey="formalization_recurring" name="Formaliz. recurrente" stackId="opex" fill="#a78bfa" />
            <Bar dataKey="formalization_one_time" name="Formaliz. one-time" stackId="opex" fill="#7c3aed" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly table */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200">
          <h4 className="font-medium text-stone-800">Detalle mes a mes</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Período</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Ingresos</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">COGS</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Util. bruta</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">OpEx</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Util. op.</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Interés</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Util. neta</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Caja acum.</th>
                <th className="px-3 py-2 text-center font-medium text-stone-600">Flags</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, idx) => (
                <tr key={idx} className={idx % 2 ? 'bg-stone-50' : ''}>
                  <td className="px-3 py-2 whitespace-nowrap text-stone-700">{m.period_label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(m.revenue)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-500">{formatCurrency(m.cogs)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(m.gross_profit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-500">{formatCurrency(m.total_opex)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${m.operating_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(m.operating_profit)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-stone-500">{formatCurrency(m.interest_expense)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${m.net_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(m.net_profit)}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${m.cumulative_cash < 0 ? 'text-red-600 font-bold' : ''}`}>
                    {formatCurrency(m.cumulative_cash)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {m.below_breakeven && (
                      <span className="inline-block w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-[10px] font-bold leading-5" title="Bajo breakeven">⚠</span>
                    )}
                    {m.cash_negative && (
                      <span className="inline-block ml-1 w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold leading-5" title="Caja negativa">✕</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
