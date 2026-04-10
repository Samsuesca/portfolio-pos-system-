/**
 * Module 2: Profitability by School
 */
import { Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ProfitabilityResponse } from '../../../services/financialModelService';

interface Props {
  data: ProfitabilityResponse | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function formatMoney(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 0) return `-$${Math.abs(rounded).toLocaleString('es-CO')}`;
  return `$${rounded.toLocaleString('es-CO')}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ProfitabilityPanel({ data }: Props) {
  if (!data || data.schools.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No hay datos de rentabilidad disponibles</p>
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
        <h3 className="text-lg font-semibold text-gray-800">Rentabilidad por Colegio</h3>
        <span className="text-xs text-gray-400">
          {data.start_date} a {data.end_date}
        </span>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h4 className="text-sm font-medium text-gray-600 mb-4">Margen de Contribución por Colegio</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v: any) => formatMoney(Number(v))} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: any) => formatMoney(Number(value))}
              labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Colegio</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ingresos</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Costo</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Gastos</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Margen</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">% Margen</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">% Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {data.schools.map((s, i) => (
                <tr key={s.school_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      {s.school_name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatMoney(s.revenue)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatMoney(s.cost_of_goods)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatMoney(s.direct_expenses)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${s.contribution_margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {formatMoney(s.contribution_margin)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatPct(s.margin_percentage)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatPct(s.revenue_share)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-3 text-gray-800">Total</td>
                <td className="px-4 py-3 text-right text-gray-800">{formatMoney(data.total_revenue)}</td>
                <td className="px-4 py-3 text-right" colSpan={5}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
