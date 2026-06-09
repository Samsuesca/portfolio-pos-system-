/**
 * Module 2: Profitability by School (margen bruto, no incluye gastos
 * operativos porque la regla del proyecto es "contabilidad GLOBAL" — los
 * Expense no se atribuyen por colegio).
 */
import { Building2, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ProfitabilityResponse } from '../../../services/financialModelService';
import { formatCurrency as formatMoney } from '../../../utils/formatting';

interface Props {
  data: ProfitabilityResponse | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function formatPct(value: number | string): string {
  return `${Number(value).toFixed(1)}%`;
}

export default function ProfitabilityPanel({ data }: Props) {
  if (!data || data.schools.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-8 text-center">
        <Building2 className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <p className="text-stone-500">No hay datos de rentabilidad disponibles</p>
      </div>
    );
  }

  const chartData = data.schools.map((s) => ({
    name: s.school_name.length > 15 ? s.school_name.substring(0, 15) + '...' : s.school_name,
    fullName: s.school_name,
    margin: Number(s.contribution_margin),
    revenue: Number(s.revenue),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-stone-800">Rentabilidad por Colegio</h3>
        <span className="text-xs text-stone-400">
          {data.start_date} a {data.end_date}
        </span>
      </div>

      {/* Nota explicativa: el panel calcula margen bruto, no neto. */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-900">
          Margen bruto = Ingresos − Costo de mercancía. Los gastos operativos
          (arriendo, servicios, nómina) son globales del negocio y se ven en
          el panel <strong>Resumen → Resumen Global</strong>. Por eso aquí
          no aparece la columna de gastos por colegio.
        </p>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <h4 className="text-sm font-medium text-stone-600 mb-4">Margen Bruto por Colegio</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value: unknown) => formatMoney(Number(value))} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: unknown) => formatMoney(Number(value))}
              labelFormatter={(label: unknown, payload: ReadonlyArray<{ payload?: { fullName?: string } }>) =>
                payload?.[0]?.payload?.fullName ?? String(label)
              }
            />
            <Bar dataKey="margin" name="Margen" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-3 font-medium text-stone-600">Colegio</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">Ingresos</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">Costo</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">Margen Bruto</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">% Margen</th>
                <th className="text-right px-4 py-3 font-medium text-stone-600">% Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.schools.map((s, i) => (
                <tr key={s.school_id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {s.school_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-stone-700">{formatMoney(s.revenue)}</td>
                  <td className="px-4 py-3 text-right text-stone-700">{formatMoney(s.cost_of_goods)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${s.contribution_margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(s.contribution_margin)}
                  </td>
                  <td className="px-4 py-3 text-right text-stone-700">{formatPct(s.margin_percentage)}</td>
                  <td className="px-4 py-3 text-right text-stone-700">{formatPct(s.revenue_share)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50 font-semibold">
                <td className="px-4 py-3 text-stone-800">Total</td>
                <td className="px-4 py-3 text-right text-stone-800">{formatMoney(data.total_revenue)}</td>
                <td className="px-4 py-3 text-right" colSpan={4}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
