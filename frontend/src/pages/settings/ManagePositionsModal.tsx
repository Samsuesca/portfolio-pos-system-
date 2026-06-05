import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Plus, Edit2, CheckCircle, XCircle, Loader2,
  Briefcase, Save,
} from 'lucide-react';
import {
  catalogService,
  type Position,
  type PositionCreate,
} from '../../services/catalogService';

type PositionView = 'list' | 'create' | 'edit';

interface ManagePositionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ManagePositionsModal: React.FC<ManagePositionsModalProps> = ({ isOpen, onClose }) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<PositionView>('list');
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [form, setForm] = useState<PositionCreate>({ code: '', name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await catalogService.getPositions(true);
      setPositions(data);
    } catch {
      setError('Error al cargar posiciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPositions();
      setView('list');
      setError(null);
    }
  }, [isOpen, loadPositions]);

  const handleOpenCreate = () => {
    setForm({ code: '', name: '', description: '' });
    setError(null);
    setView('create');
  };

  const handleOpenEdit = (position: Position) => {
    setSelectedPosition(position);
    setForm({ code: position.code, name: position.name, description: position.description || '' });
    setError(null);
    setView('edit');
  };

  const handleSave = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('Codigo y nombre son requeridos');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (view === 'create') {
        await catalogService.createPosition(form);
      } else if (selectedPosition) {
        await catalogService.updatePosition(selectedPosition.id, {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
        });
      }
      await loadPositions();
      setView('list');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al guardar';
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (position: Position) => {
    try {
      await catalogService.updatePosition(position.id, { is_active: !position.is_active });
      await loadPositions();
    } catch {
      setError('Error al cambiar estado');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-stone-800">
              {view === 'list' ? 'Cargos' : view === 'create' ? 'Nuevo Cargo' : 'Editar Cargo'}
            </h2>
          </div>
          <button onClick={view === 'list' ? onClose : () => setView('list')} className="p-1 hover:bg-stone-100 rounded">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {view === 'list' ? (
            <>
              <button
                onClick={handleOpenCreate}
                className="w-full mb-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Agregar Cargo
              </button>

              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
                </div>
              ) : positions.length === 0 ? (
                <p className="text-center text-stone-500 py-8">No hay cargos registrados</p>
              ) : (
                <div className="space-y-2">
                  {positions.map((pos) => (
                    <div
                      key={pos.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        pos.is_active ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100 opacity-60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-800">{pos.name}</span>
                          <span className="text-xs text-stone-400 font-mono">{pos.code}</span>
                        </div>
                        {pos.description && (
                          <p className="text-xs text-stone-500 mt-0.5 truncate">{pos.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleToggleActive(pos)}
                          className="p-1.5 hover:bg-stone-100 rounded"
                          title={pos.is_active ? 'Desactivar' : 'Activar'}
                        >
                          {pos.is_active ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-stone-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(pos)}
                          className="p-1.5 hover:bg-stone-100 rounded"
                        >
                          <Edit2 className="w-4 h-4 text-stone-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Create / Edit Form */
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Codigo</label>
                <input
                  type="text"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="vendedor"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <p className="text-xs text-stone-400 mt-1">Identificador unico en minusculas, sin espacios</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Vendedor"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Descripcion</label>
                <input
                  type="text"
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Vendedor de punto de venta"
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer (save button for create/edit) */}
        {view !== 'list' && (
          <div className="p-4 border-t flex justify-end gap-2">
            <button
              onClick={() => setView('list')}
              className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ManagePositionsModal);
