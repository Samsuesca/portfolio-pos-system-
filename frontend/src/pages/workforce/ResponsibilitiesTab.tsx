import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import workforceService, {
  PositionResponsibility,
  PositionResponsibilityCreate,
  ResponsibilityCategory,
  RESPONSIBILITY_CATEGORY_LABELS,
  RESPONSIBILITY_CATEGORY_COLORS,
} from '../../services/workforceService';
import { extractErrorMessage } from '../../utils/api-client';

const EMPTY_RESP_FORM = {
  position: '',
  title: '',
  description: '',
  category: 'core' as ResponsibilityCategory,
  sort_order: 0,
};

export default function ResponsibilitiesTab() {
  const [responsibilities, setResponsibilities] = useState<PositionResponsibility[]>([]);
  const [respLoading, setRespLoading] = useState(false);
  const [respPositionFilter, setRespPositionFilter] = useState('');
  const [showRespModal, setShowRespModal] = useState(false);
  const [editingResp, setEditingResp] = useState<PositionResponsibility | null>(null);
  const [respForm, setRespForm] = useState({ ...EMPTY_RESP_FORM });
  const [respError, setRespError] = useState('');

  const loadResponsibilities = useCallback(async () => {
    setRespLoading(true);
    try {
      const params: { position?: string; is_active?: boolean } = { is_active: true };
      if (respPositionFilter) params.position = respPositionFilter;
      const data = await workforceService.getResponsibilities(params);
      setResponsibilities(data);
    } catch (err) {
      console.error('Error loading responsibilities:', err);
    } finally {
      setRespLoading(false);
    }
  }, [respPositionFilter]);

  useEffect(() => {
    loadResponsibilities();
  }, [loadResponsibilities]);

  // Unique positions for filter dropdown (filter out nulls)
  const uniquePositions = Array.from(new Set(responsibilities.map((r) => r.position).filter((p): p is string => p !== null))).sort();

  // Group by position, then by category
  const filtered = respPositionFilter
    ? responsibilities.filter((r) => r.position === respPositionFilter)
    : responsibilities;

  const groupedByPosition: Record<string, PositionResponsibility[]> = {};
  for (const r of filtered) {
    const pos = r.position || 'Sin cargo';
    if (!groupedByPosition[pos]) groupedByPosition[pos] = [];
    groupedByPosition[pos].push(r);
  }

  // Sort within each position group by category then sort_order
  const categoryOrder: ResponsibilityCategory[] = ['core', 'administrative', 'customer_service', 'operational'];
  for (const pos of Object.keys(groupedByPosition)) {
    groupedByPosition[pos].sort((a, b) => {
      const catDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return a.sort_order - b.sort_order;
    });
  }

  const openCreateModal = () => {
    setEditingResp(null);
    setRespForm({ ...EMPTY_RESP_FORM });
    setRespError('');
    setShowRespModal(true);
  };

  const openEditModal = (resp: PositionResponsibility) => {
    setEditingResp(resp);
    setRespForm({
      position: resp.position || '',
      title: resp.title,
      description: resp.description || '',
      category: resp.category,
      sort_order: resp.sort_order,
    });
    setRespError('');
    setShowRespModal(true);
  };

  const handleSave = async () => {
    if (!respForm.position.trim() || !respForm.title.trim()) {
      setRespError('Cargo y titulo son obligatorios.');
      return;
    }
    try {
      if (editingResp) {
        await workforceService.updateResponsibility(editingResp.id, {
          title: respForm.title,
          description: respForm.description || undefined,
          category: respForm.category,
          sort_order: respForm.sort_order,
        });
      } else {
        const createData: PositionResponsibilityCreate = {
          position: respForm.position.trim(),
          title: respForm.title.trim(),
          description: respForm.description?.trim() || undefined,
          category: respForm.category,
          sort_order: respForm.sort_order,
        };
        await workforceService.createResponsibility(createData);
      }
      setShowRespModal(false);
      loadResponsibilities();
    } catch (err: any) {
      setRespError(extractErrorMessage(err));
    }
  };

  const handleDelete = async (resp: PositionResponsibility) => {
    if (!window.confirm(`Eliminar responsabilidad "${resp.title}"?`)) return;
    try {
      await workforceService.deleteResponsibility(resp.id);
      loadResponsibilities();
    } catch (err) {
      console.error('Error deleting responsibility:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Filtrar por cargo:</label>
          <select
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
            value={respPositionFilter}
            onChange={(e) => setRespPositionFilter(e.target.value)}
          >
            <option value="">Todos</option>
            {uniquePositions.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>
        <RequirePermission permission="workforce.manage_shifts">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
          >
            <Plus size={16} />
            Nueva Responsabilidad
          </button>
        </RequirePermission>
      </div>

      {/* Loading */}
      {respLoading && (
        <div className="text-center py-8 text-gray-500 text-sm">Cargando responsabilidades...</div>
      )}

      {/* Empty state */}
      {!respLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ShieldCheck size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">No hay responsabilidades registradas</p>
          <p className="text-sm mt-1">Crea la primera responsabilidad para un cargo.</p>
        </div>
      )}

      {/* Grouped content */}
      {!respLoading && Object.keys(groupedByPosition).sort().map((position) => {
        const items = groupedByPosition[position];
        // Group by category within position
        const byCategory: Partial<Record<ResponsibilityCategory, PositionResponsibility[]>> = {};
        for (const item of items) {
          if (!byCategory[item.category]) byCategory[item.category] = [];
          byCategory[item.category]!.push(item);
        }

        return (
          <div key={position} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Position header */}
            <div className="bg-gray-50 px-5 py-3 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">{position}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {items.length} responsabilidad{items.length !== 1 ? 'es' : ''}
              </p>
            </div>

            <div className="p-5 space-y-4">
              {categoryOrder.map((cat) => {
                const catItems = byCategory[cat];
                if (!catItems || catItems.length === 0) return null;
                return (
                  <div key={cat}>
                    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2 ${RESPONSIBILITY_CATEGORY_COLORS[cat]}`}>
                      {RESPONSIBILITY_CATEGORY_LABELS[cat]}
                    </span>
                    <div className="space-y-2 ml-1">
                      {catItems.map((resp) => (
                        <div
                          key={resp.id}
                          className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-900">{resp.title}</p>
                            {resp.description && (
                              <p className="text-xs text-slate-600 mt-0.5">{resp.description}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Orden: {resp.sort_order}</p>
                          </div>
                          <RequirePermission permission="workforce.manage_shifts">
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => openEditModal(resp)}
                                className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded"
                                title="Editar"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(resp)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Eliminar"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </RequirePermission>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Create/Edit Modal */}
      {showRespModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingResp ? 'Editar Responsabilidad' : 'Nueva Responsabilidad'}
              </h2>
              <button onClick={() => setShowRespModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {respError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle size={16} />
                  {respError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej: Vendedora, Costurera, Administradora"
                  value={respForm.position}
                  onChange={(e) => setRespForm({ ...respForm, position: e.target.value })}
                  disabled={!!editingResp}
                />
                {editingResp && (
                  <p className="text-xs text-gray-400 mt-1">El cargo no se puede cambiar al editar.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titulo *</label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Ej: Atender clientes en tienda"
                  value={respForm.title}
                  onChange={(e) => setRespForm({ ...respForm, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  rows={3}
                  placeholder="Descripcion detallada de la responsabilidad (opcional)"
                  value={respForm.description}
                  onChange={(e) => setRespForm({ ...respForm, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500"
                    value={respForm.category}
                    onChange={(e) => setRespForm({ ...respForm, category: e.target.value as ResponsibilityCategory })}
                  >
                    {(Object.keys(RESPONSIBILITY_CATEGORY_LABELS) as ResponsibilityCategory[]).map((cat) => (
                      <option key={cat} value={cat}>{RESPONSIBILITY_CATEGORY_LABELS[cat]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orden</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    min={0}
                    value={respForm.sort_order}
                    onChange={(e) => setRespForm({ ...respForm, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowRespModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700"
              >
                {editingResp ? 'Guardar Cambios' : 'Crear Responsabilidad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
