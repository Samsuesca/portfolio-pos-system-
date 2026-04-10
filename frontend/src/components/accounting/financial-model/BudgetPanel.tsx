/**
 * Module 4: Budget vs Actual
 */
import { useState } from 'react';
import { Target, Plus, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { financialModelService } from '../../../services/financialModelService';
import type { BudgetVsActualResponse, BudgetItem, BudgetCreate } from '../../../services/financialModelService';

interface Props {
  budgetVsActual: BudgetVsActualResponse | null;
  budgets: BudgetItem[];
  onRefresh: () => void;
}

function formatMoney(value: number): string {
  const rounded = Math.round(value);
  return `$${rounded.toLocaleString('es-CO')}`;
}

const STATUS_STYLES = {
  within: 'bg-green-100 text-green-800',
  near_limit: 'bg-yellow-100 text-yellow-800',
  over: 'bg-red-100 text-red-800',
};

const STATUS_LABELS = {
  within: 'Dentro',
  near_limit: 'Cerca del límite',
  over: 'Sobrepasado',
};

export default function BudgetPanel({ budgetVsActual, budgets, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<BudgetCreate>({
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    category: '',
    budgeted_amount: 0,
  });

  const handleCreate = async () => {
    if (!form.category || !form.period_start || form.budgeted_amount <= 0) return;
    setSubmitting(true);
    try {
      await financialModelService.createBudget(form);
      setShowForm(false);
      setForm({ period_type: 'monthly', period_start: '', period_end: '', category: '', budgeted_amount: 0 });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este presupuesto?')) return;
    try {
      await financialModelService.deleteBudget(id);
      onRefresh();
    } catch {
      // ignore
    }
  };

  // Chart data
  const chartData = budgetVsActual?.items.map(item => ({
    name: item.category_label,
    Presupuesto: Number(item.budgeted),
    Real: Number(item.actual),
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Presupuesto vs Real</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo Presupuesto
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="font-medium text-gray-800 mb-4">Crear Presupuesto</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Período</label>
              <select
                value={form.period_type}
                onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="monthly">Mensual</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
              <input
                type="date"
                value={form.period_start}
                onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
              <input
                type="date"
                value={form.period_end}
                onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="ej: revenue, rent, payroll"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto Presupuestado</label>
              <input
                type="number"
                value={form.budgeted_amount || ''}
                onChange={(e) => setForm({ ...form, budgeted_amount: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => formatMoney(v)} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatMoney(Number(v))} />
              <Legend />
              <Bar dataKey="Presupuesto" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Real" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Comparison table */}
      {budgetVsActual && budgetVsActual.items.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Presupuesto</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Real</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Variación</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">%</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody>
                {budgetVsActual.items.map((item) => (
                  <tr key={item.category} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{item.category_label}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(item.budgeted)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(item.actual)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${Number(item.variance) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {formatMoney(item.variance)}
                    </td>
                    <td className="px-4 py-3 text-right">{Number(item.variance_percentage).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[item.status]}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Existing budgets list */}
      {budgets.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h4 className="font-medium text-gray-800 mb-4">Presupuestos Creados</h4>
          <div className="space-y-2">
            {budgets.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium text-gray-800">{b.category}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    {b.period_start} — {b.period_end} ({b.period_type})
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-800">{formatMoney(b.budgeted_amount)}</span>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!budgetVsActual && budgets.length === 0 && !showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No hay presupuestos creados</p>
          <p className="text-gray-400 text-sm mt-1">Cree un presupuesto para comparar con los gastos reales</p>
        </div>
      )}
    </div>
  );
}
