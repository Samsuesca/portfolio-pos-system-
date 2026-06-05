/**
 * Cost Insights Tab — dashboard agregado de costos.
 *
 * Vive como cuarta pestaña de Productos (gated por canViewCosts).
 * Renderiza: 4 KPI cards + tabla por colegio + 2 BarCharts (best/worst margen)
 * + PieChart de distribución por componente.
 */
import { useEffect, useState, useCallback } from 'react';
import { extractErrorMessage } from '../../utils/api-client';
import {
  RefreshCw, AlertCircle, Loader2, Package, TrendingUp, AlertTriangle, Wallet,
  Building2, BarChart3 as BarChart3Icon, PieChart as PieChartIcon, ArrowDown, ArrowUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import { StatCard } from '../../components/dashboard/StatCard';
import * as costInsightsService from '../../services/costInsightsService';
import type {
  CostInsightsSummary, SchoolCostBreakdown, TopMarginProduct, ComponentDistribution,
} from '../../services/costInsightsService';
import { formatCurrency } from '../../utils/formatting';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

function fmtPct(value: number | null | undefined): string {
  return value == null ? '—' : `${Number(value).toFixed(1)}%`;
}

function fmtMoney(value: number | null | undefined): string {
  if (value == null) return '—';
  return formatCurrency(value);
}

const marginColorClass = (m: number) =>
  m > 30 ? 'text-green-600' : m > 15 ? 'text-amber-600' : 'text-red-600';


function MarginBarChart({ data, title, icon: Icon }: {
  data: TopMarginProduct[];
  title: string;
  icon: typeof TrendingUp;
}) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-4 h-4 text-stone-400" />
          <h4 className="text-sm font-medium text-stone-700">{title}</h4>
        </div>
        <p className="text-sm text-stone-400 text-center py-8">Sin productos con costo todavía</p>
      </div>
    );
  }

  // Label = nombre del producto con talla. Trunca a 30 chars para no romper
  // layout; el tooltip muestra el nombre completo + colegio.
  const truncate = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;
  // Drop products without a computed margin (price=0 / not costed yet) so they
  // don't render as a misleading 0% bar in the best/worst margin charts.
  const chartData = data
    .filter(p => p.margin_percent != null && !Number.isNaN(Number(p.margin_percent)))
    .map(p => ({
      label: truncate(`${p.name || p.code} · ${p.size}`, 30),
      margin: Number(p.margin_percent),
      fullName: `${p.name || p.code} (${p.size}) — ${p.school_name || 'Global'}`,
      cost: p.cost,
      price: p.price,
    }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-stone-400" />
        <h4 className="text-sm font-medium text-stone-700">{title}</h4>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 20, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="label" width={200} tick={{ fontSize: 11 }} />
          <Tooltip
            formatter={(value: unknown) => `${Number(value).toFixed(1)}%`}
            labelFormatter={(_: unknown, payload: ReadonlyArray<{ payload?: { fullName?: string } }>) =>
              payload?.[0]?.payload?.fullName ?? ''
            }
          />
          <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
            {chartData.map((d, i) => (
              <Cell
                key={i}
                fill={
                  d.margin < 0 ? '#ef4444'
                  : d.margin < 15 ? '#f97316'
                  : d.margin < 30 ? '#f59e0b'
                  : '#10b981'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}


function ComponentPie({ data }: { data: ComponentDistribution[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChartIcon className="w-4 h-4 text-stone-400" />
          <h4 className="text-sm font-medium text-stone-700">Distribución del costo</h4>
        </div>
        <p className="text-sm text-stone-400 text-center py-8">Sin componentes para agregar</p>
      </div>
    );
  }

  const pieData = data.map(d => ({
    name: d.template_name,
    value: Number(d.total_amount),
    percent: Number(d.percent_of_total),
    code: d.template_code,
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <PieChartIcon className="w-4 h-4 text-stone-400" />
        <h4 className="text-sm font-medium text-stone-700">Distribución del costo por componente</h4>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={(entry: { percent?: number }) => entry.percent != null ? `${entry.percent.toFixed(1)}%` : ''}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: unknown) => formatCurrency(Number(value))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}


export default function CostInsightsTab() {
  const [summary, setSummary] = useState<CostInsightsSummary | null>(null);
  const [bySchool, setBySchool] = useState<SchoolCostBreakdown[]>([]);
  const [topBest, setTopBest] = useState<TopMarginProduct[]>([]);
  const [topWorst, setTopWorst] = useState<TopMarginProduct[]>([]);
  const [distribution, setDistribution] = useState<ComponentDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, bs, best, worst, dist] = await Promise.all([
        costInsightsService.getSummary(),
        costInsightsService.getBySchool(),
        costInsightsService.getTopMargin('best', 10),
        costInsightsService.getTopMargin('worst', 10),
        costInsightsService.getComponentDistribution(),
      ]);
      setSummary(s);
      setBySchool(bs);
      setTopBest(best);
      setTopWorst(worst);
      setDistribution(dist);
    } catch (e: unknown) {
      setError(extractErrorMessage(e) || 'Error al cargar análisis de costos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <span className="ml-3 text-stone-500">Cargando análisis de costos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-red-700 font-medium">{error}</p>
          <button onClick={loadAll} className="mt-2 text-sm text-red-700 hover:text-red-800 underline">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const noData = summary.products_with_cost === 0;
  if (noData) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-12 text-center">
        <BarChart3Icon className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <h3 className="text-base font-medium text-stone-700">Aún no hay productos con costos</h3>
        <p className="text-sm text-stone-500 mt-1">
          Configurá costos en la pestaña <span className="font-medium">Productos del Colegio</span> con
          "Gestionar Costos" o desde <span className="font-medium">Tipos de Prenda</span> con "Ver costos".
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Análisis de costos</h2>
          <p className="text-sm text-stone-500">
            Cobertura, márgenes y composición de costos en todos tus colegios.
          </p>
        </div>
        <button
          onClick={loadAll}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg"
          title="Refrescar"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refrescar
        </button>
      </div>

      {/* 4 KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cobertura"
          value={fmtPct(summary.coverage_percent)}
          subtitle={`${summary.products_with_cost}/${summary.total_active_products} con costo`}
          icon={Package}
          color="text-brand-600"
          bgColor="bg-brand-50"
        />
        <StatCard
          title="Margen promedio"
          value={fmtPct(summary.avg_margin_percent)}
          subtitle={`Precio prom: ${fmtMoney(summary.avg_price)}`}
          icon={TrendingUp}
          color="text-green-600"
          bgColor="bg-green-50"
        />
        <StatCard
          title="Costo promedio"
          value={fmtMoney(summary.avg_cost)}
          subtitle={`Manuf: ${summary.manufactured_total} · Compra: ${summary.purchased_total}`}
          icon={Wallet}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
        <StatCard
          title="Productos underwater"
          value={summary.underwater_count.toString()}
          subtitle={summary.underwater_count > 0 ? 'Revisar: cost > price' : 'Todos rentables'}
          icon={AlertTriangle}
          color={summary.underwater_count > 0 ? 'text-red-600' : 'text-stone-500'}
          bgColor={summary.underwater_count > 0 ? 'bg-red-50' : 'bg-stone-50'}
        />
      </div>

      {/* Tabla por colegio */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-stone-400" />
          <h3 className="text-sm font-medium text-stone-700">Por colegio</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-stone-600">Colegio</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-600">Productos</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-600">Con costo</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-600">Cobertura</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-600">Costo prom.</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-600">Margen prom.</th>
                <th className="text-right px-4 py-2.5 font-medium text-stone-600">Underwater</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bySchool.map(r => (
                <tr key={r.school_id || 'global'} className="hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-stone-900">{r.school_name}</div>
                    <div className="text-xs text-stone-400 font-mono">{r.school_code}</div>
                  </td>
                  <td className="px-4 py-2 text-right text-stone-600">{r.products_total}</td>
                  <td className="px-4 py-2 text-right text-stone-900">{r.products_with_cost}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-medium ${
                      r.coverage_percent >= 90 ? 'text-green-600'
                      : r.coverage_percent >= 50 ? 'text-amber-600'
                      : 'text-red-600'
                    }`}>
                      {fmtPct(r.coverage_percent)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-stone-700">{fmtMoney(r.avg_cost)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={`font-medium ${
                      r.avg_margin_percent == null ? 'text-stone-400'
                      : marginColorClass(Number(r.avg_margin_percent))
                    }`}>
                      {fmtPct(r.avg_margin_percent)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {r.underwater_count > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs bg-red-50 text-red-700">
                        {r.underwater_count}
                      </span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top/Worst margin charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MarginBarChart data={topBest} title="Mejor margen (top 10)" icon={ArrowUp} />
        <MarginBarChart data={topWorst} title="Peor margen (top 10)" icon={ArrowDown} />
      </div>

      {/* Distribución por componente */}
      <ComponentPie data={distribution} />
    </div>
  );
}
