import { useState, useEffect, useCallback } from 'react';
import workforceService, { DailyChecklist, DailyChecklistItem } from '../services/workforceService';

interface Props {
  employeeId: string;
}

export default function MyChecklistWidget({ employeeId }: Props) {
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
      const data = await workforceService.getDailyChecklists({ employee_id: employeeId, checklist_date: today });
      if (data.length > 0) {
        setChecklist(data[0]);
      }
    } catch {
      // No checklist
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeId) load();
  }, [employeeId, load]);

  const toggleItem = async (item: DailyChecklistItem) => {
    if (updating) return;
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    setUpdating(item.id);
    try {
      await workforceService.updateChecklistItemStatus(item.id, { status: newStatus });
      await load();
    } catch {
      // Failed to update
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Mi Checklist de Hoy</h3>
        <p className="text-sm text-slate-400">Cargando...</p>
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Mi Checklist de Hoy</h3>
        <p className="text-sm text-slate-400">No hay checklist asignado para hoy.</p>
      </div>
    );
  }

  const completionPct = Math.round(checklist.completion_rate);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Mi Checklist de Hoy</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          completionPct === 100
            ? 'bg-green-100 text-green-700'
            : completionPct > 0
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-slate-100 text-slate-600'
        }`}>
          {checklist.completed_items}/{checklist.total_items}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all ${
            completionPct === 100 ? 'bg-green-500' : 'bg-brand-500'
          }`}
          style={{ width: `${completionPct}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {checklist.items
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => (
            <button
              key={item.id}
              onClick={() => toggleItem(item)}
              disabled={updating === item.id || !!checklist.verified_at}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors ${
                item.status === 'completed'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
              } disabled:opacity-60`}
            >
              <span className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                item.status === 'completed'
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-slate-300'
              }`}>
                {item.status === 'completed' && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={item.status === 'completed' ? 'line-through' : ''}>
                {item.description}
              </span>
              {item.is_required && item.status !== 'completed' && (
                <span className="ml-auto text-xs text-red-400">*</span>
              )}
            </button>
          ))}
      </div>

      {checklist.verified_at && (
        <div className="mt-3 text-xs text-green-600 font-medium">
          Verificado por supervisor
        </div>
      )}
    </div>
  );
}
