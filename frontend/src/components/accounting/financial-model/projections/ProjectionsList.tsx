/**
 * ProjectionsList - Lista de proyecciones guardadas con comparativo lado-a-lado.
 *
 * Permite seleccionar hasta 3 escenarios para comparar summaries (totales,
 * márgenes, breakeven, caja final, meses negativos).
 */
import { useState } from 'react';
import {
  Trash2, Eye, FileText, Loader2, BarChart3, AlertCircle, RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '../../../../utils/formatting';
import type { ProjectionListItem } from '../../../../services/projectionService';

interface Props {
  items: ProjectionListItem[];
  loading: boolean;
  error: string | null;
  canDelete: boolean;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onFilterScenario: (scenario: string | null) => void;
  scenarioFilter: string | null;
}

const MAX_COMPARE = 3;

const SCENARIO_BADGE: Record<string, string> = {
  A: 'bg-yellow-100 text-yellow-700',
  B: 'bg-emerald-100 text-emerald-700',
  C: 'bg-purple-100 text-purple-700',
  custom: 'bg-stone-100 text-stone-700',
};

function scenarioBadge(label: string | null) {
  if (!label) return 'bg-stone-100 text-stone-700';
  return SCENARIO_BADGE[label] ?? SCENARIO_BADGE.custom;
}

export default function ProjectionsList({
  items, loading, error, canDelete, onView, onDelete, onRefresh, onFilterScenario, scenarioFilter,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const selectedItems = items.filter((it) => selectedIds.includes(it.id));

  const handleDelete = (id: string) => {
    if (confirmingDelete === id) {
      onDelete(id);
      setConfirmingDelete(null);
      setSelectedIds((prev) => prev.filter((x) => x !== id));
    } else {
      setConfirmingDelete(id);
      setTimeout(() => setConfirmingDelete(null), 4000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header con filtros */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-600">Filtrar por escenario:</span>
          {(['A', 'B', 'C', 'custom'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onFilterScenario(scenarioFilter === s ? null : s)}
              className={`px-2 py-1 text-xs rounded ${
                scenarioFilter === s
                  ? 'bg-brand-500 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {s}
            </button>
          ))}
          {scenarioFilter && (
            <button
              type="button"
              onClick={() => onFilterScenario(null)}
              className="text-xs text-stone-500 underline"
            >
              limpiar
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-stone-500 hover:text-stone-700 flex items-center gap-1 text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="text-center py-12 bg-stone-50 rounded-lg border border-dashed border-stone-300">
          <FileText className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-stone-500 text-sm">
            No hay proyecciones guardadas{scenarioFilter ? ` para escenario ${scenarioFilter}` : ''}.
          </p>
          <p className="text-stone-400 text-xs mt-1">
            Crea una nueva proyección desde la pestaña "Nueva proyección".
          </p>
        </div>
      )}

      {/* Lista */}
      {!loading && items.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-stone-600 w-12">
                  <span title={`Selecciona hasta ${MAX_COMPARE} para comparar`}>Cmp.</span>
                </th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Escenario</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Meses</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Util. neta</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Caja final</th>
                <th className="px-3 py-2 text-left font-medium text-stone-600">Creada</th>
                <th className="px-3 py-2 text-right font-medium text-stone-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const checked = selectedIds.includes(item.id);
                const disabled = !checked && selectedIds.length >= MAX_COMPARE;
                return (
                  <tr key={item.id} className={`border-t border-stone-100 ${checked ? 'bg-brand-50' : ''}`}>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleSelect(item.id)}
                        className="rounded border-stone-300 disabled:opacity-30"
                      />
                    </td>
                    <td className="px-3 py-2 text-stone-700">{item.name}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${scenarioBadge(item.scenario_label)}`}>
                        {item.scenario_label ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-600">{item.months_count}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${item.summary.total_net_profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {formatCurrency(item.summary.total_net_profit)}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${item.summary.ending_cash < 0 ? 'text-red-600' : ''}`}>
                      {formatCurrency(item.summary.ending_cash)}
                    </td>
                    <td className="px-3 py-2 text-stone-500 text-xs">
                      {new Date(item.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onView(item.id)}
                          className="text-brand-600 hover:text-brand-700"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className={`${confirmingDelete === item.id ? 'text-red-700 font-bold' : 'text-red-500'} hover:text-red-700`}
                            title={confirmingDelete === item.id ? 'Click otra vez para confirmar' : 'Eliminar'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Comparativo */}
      {selectedItems.length >= 2 && (
        <div className="bg-white border-2 border-brand-300 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-5 h-5 text-brand-600" />
            <h4 className="font-semibold text-stone-800">Comparativo de escenarios ({selectedItems.length})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200">
                  <th className="px-2 py-2 text-left font-medium text-stone-600">Métrica</th>
                  {selectedItems.map((it) => (
                    <th key={it.id} className="px-2 py-2 text-right font-medium text-stone-700">
                      <div>{it.name}</div>
                      <div className="text-[10px] text-stone-400 font-normal">
                        Esc. {it.scenario_label ?? '—'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ComparisonRow
                  label="Ingresos totales"
                  values={selectedItems.map((it) => it.summary.total_revenue)}
                  format={formatCurrency}
                />
                <ComparisonRow
                  label="Utilidad neta total"
                  values={selectedItems.map((it) => it.summary.total_net_profit)}
                  format={formatCurrency}
                  highlight="max"
                />
                <ComparisonRow
                  label="Margen neto promedio"
                  values={selectedItems.map((it) => it.summary.avg_net_margin_pct)}
                  format={(v) => `${v.toFixed(1)}%`}
                  highlight="max"
                />
                <ComparisonRow
                  label="Caja final"
                  values={selectedItems.map((it) => it.summary.ending_cash)}
                  format={formatCurrency}
                  highlight="max"
                />
                <ComparisonRow
                  label="Mín. caja"
                  values={selectedItems.map((it) => it.summary.min_cash)}
                  format={formatCurrency}
                  highlight="max"
                />
                <ComparisonRow
                  label="Meses caja negativa"
                  values={selectedItems.map((it) => it.summary.months_cash_negative)}
                  format={(v) => String(v)}
                  highlight="min"
                />
                <ComparisonRow
                  label="Meses bajo breakeven"
                  values={selectedItems.map((it) => it.summary.months_below_breakeven)}
                  format={(v) => String(v)}
                  highlight="min"
                />
                <ComparisonRow
                  label="Costos formaliz. (one-time)"
                  values={selectedItems.map((it) => it.summary.total_formalization_one_time)}
                  format={formatCurrency}
                />
                <ComparisonRow
                  label="Costos formaliz. (recurrentes)"
                  values={selectedItems.map((it) => it.summary.total_formalization_recurring)}
                  format={formatCurrency}
                />
                <ComparisonRow
                  label="Breakeven mensual"
                  values={selectedItems.map((it) => it.summary.breakeven_revenue_monthly_avg)}
                  format={formatCurrency}
                  highlight="min"
                />
              </tbody>
            </table>
          </div>
          <p className="text-xs text-stone-400 mt-2">
            Verde = mejor valor, rojo = peor. La selección persiste mientras navegas la lista.
          </p>
        </div>
      )}
    </div>
  );
}

interface ComparisonRowProps {
  label: string;
  values: number[];
  format: (v: number) => string;
  highlight?: 'max' | 'min';
}

function ComparisonRow({ label, values, format, highlight }: ComparisonRowProps) {
  const best = highlight === 'max' ? Math.max(...values) : highlight === 'min' ? Math.min(...values) : null;
  const worst = highlight === 'max' ? Math.min(...values) : highlight === 'min' ? Math.max(...values) : null;
  return (
    <tr className="border-b border-stone-100">
      <td className="px-2 py-2 text-stone-600">{label}</td>
      {values.map((v, i) => {
        let cls = 'tabular-nums';
        if (highlight && values.length > 1) {
          if (v === best) cls += ' text-emerald-700 font-medium';
          else if (v === worst) cls += ' text-red-600';
        }
        return (
          <td key={i} className={`px-2 py-2 text-right ${cls}`}>{format(v)}</td>
        );
      })}
    </tr>
  );
}
