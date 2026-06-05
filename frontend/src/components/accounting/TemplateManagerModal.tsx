/**
 * TemplateManagerModal — CRUD de templates de costo por garment_type.
 *
 * Sub-modal del CostBreakdownModal (z-[70] para apilarse sobre z-[60]).
 * Permite activar/desactivar, crear, editar y eliminar (soft-delete) los
 * templates de componentes para una prenda específica.
 *
 * Permisos: gated por `canManageCostTemplates` (`costs.manage_templates`).
 * El servicio backend `_recalculate_product_cost` solo suma templates activos,
 * así que desactivar un template lo oculta de la UI y excluye su data de la
 * suma — sin perderla.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  X, Loader2, Plus, Trash2, Check, AlertCircle, Settings,
} from 'lucide-react';
import * as costService from '../../services/costComponentService';
import type { CostComponentTemplate } from '../../services/costComponentService';
import { usePermissions } from '../../hooks/usePermissions';

interface TemplateManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  garmentTypeId: string;
  garmentTypeName: string;
  isGlobal?: boolean;
  onTemplatesChanged?: () => void;
}

interface EditState {
  templateId: string;
  name: string;
  display_order: number;
  is_variable: boolean;
}

const slugify = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({
  isOpen,
  onClose,
  schoolId,
  garmentTypeId,
  garmentTypeName,
  isGlobal = false,
  onTemplatesChanged,
}) => {
  const { canManageCostTemplates } = usePermissions();
  const [templates, setTemplates] = useState<CostComponentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  // Form para crear nuevo template
  const [creating, setCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '', code: '', is_variable: false,
  });

  // Confirmación de eliminación. window.confirm() en Tauri/WebKit no bloquea,
  // así que usamos un modal custom para asegurar que el delete espera la respuesta.
  const [pendingDelete, setPendingDelete] = useState<CostComponentTemplate | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await costService.getTemplates(garmentTypeId, schoolId, isGlobal, true);
      setTemplates(all);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al cargar componentes');
    } finally {
      setLoading(false);
    }
  }, [garmentTypeId, schoolId, isGlobal]);

  useEffect(() => {
    if (isOpen) loadTemplates();
  }, [isOpen, loadTemplates]);

  const notifyChanged = () => onTemplatesChanged?.();

  const handleToggleActive = async (t: CostComponentTemplate) => {
    if (!canManageCostTemplates) return;
    setSaving(true);
    setError(null);
    try {
      await costService.updateTemplate(
        garmentTypeId, t.id, { is_active: !t.is_active }, schoolId, isGlobal,
      );
      await loadTemplates();
      notifyChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al cambiar estado');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (t: CostComponentTemplate) => {
    if (!canManageCostTemplates) return;
    setPendingDelete(t);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const t = pendingDelete;
    setSaving(true);
    setError(null);
    try {
      await costService.deleteTemplate(garmentTypeId, t.id, schoolId, isGlobal);
      setPendingDelete(null);
      await loadTemplates();
      notifyChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (t: CostComponentTemplate) => {
    setEditing({
      templateId: t.id,
      name: t.name,
      display_order: t.display_order,
      is_variable: t.is_variable,
    });
  };

  const cancelEdit = () => setEditing(null);

  const saveEdit = async () => {
    if (!editing || !canManageCostTemplates) return;
    setSaving(true);
    setError(null);
    try {
      await costService.updateTemplate(
        garmentTypeId,
        editing.templateId,
        {
          name: editing.name,
          display_order: editing.display_order,
          is_variable: editing.is_variable,
        },
        schoolId,
        isGlobal,
      );
      setEditing(null);
      await loadTemplates();
      notifyChanged();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!canManageCostTemplates) return;
    if (!newTemplate.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    const code = newTemplate.code.trim() || slugify(newTemplate.name);
    if (!code) {
      setError('El código no puede estar vacío');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const maxOrder = templates.reduce((m, t) => Math.max(m, t.display_order), 0);
      await costService.createTemplate(
        garmentTypeId,
        {
          name: newTemplate.name.trim(),
          code,
          is_variable: newTemplate.is_variable,
          display_order: maxOrder + 1,
        },
        schoolId,
        isGlobal,
      );
      setNewTemplate({ name: '', code: '', is_variable: false });
      setCreating(false);
      await loadTemplates();
      notifyChanged();
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(detail || 'Error al crear componente');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const active = templates.filter(t => t.is_active);
  const inactive = templates.filter(t => !t.is_active);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
              <Settings className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-stone-900">
                Componentes de costo — {garmentTypeName}
              </h3>
              <p className="text-xs text-stone-500">
                Configura qué componentes aplican a esta prenda. Los desactivados
                conservan su data pero no suman al costo.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-2" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!canManageCostTemplates && (
          <div className="mx-6 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Necesitas el permiso <code className="font-mono text-xs">costs.manage_templates</code> para editar.
          </div>
        )}

        {error && (
          <div className="mx-6 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {active.map(t => (
                  <TemplateRow
                    key={t.id}
                    template={t}
                    editing={editing?.templateId === t.id ? editing : null}
                    setEditing={setEditing}
                    onEdit={() => startEdit(t)}
                    onCancelEdit={cancelEdit}
                    onSaveEdit={saveEdit}
                    onToggleActive={() => handleToggleActive(t)}
                    onDelete={() => requestDelete(t)}
                    canEdit={canManageCostTemplates}
                    saving={saving}
                  />
                ))}
              </div>

              {inactive.length > 0 && (
                <div className="mt-6">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                    Desactivados ({inactive.length})
                  </p>
                  <div className="space-y-2">
                    {inactive.map(t => (
                      <TemplateRow
                        key={t.id}
                        template={t}
                        editing={null}
                        setEditing={setEditing}
                        onEdit={() => startEdit(t)}
                        onCancelEdit={cancelEdit}
                        onSaveEdit={saveEdit}
                        onToggleActive={() => handleToggleActive(t)}
                        onDelete={() => requestDelete(t)}
                        canEdit={canManageCostTemplates}
                        saving={saving}
                        muted
                      />
                    ))}
                  </div>
                </div>
              )}

              {canManageCostTemplates && (
                <div className="mt-6 border-t border-stone-200 pt-4">
                  {creating ? (
                    <div className="space-y-3 bg-stone-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">Nombre *</label>
                          <input
                            type="text"
                            value={newTemplate.name}
                            onChange={(e) => setNewTemplate(s => ({ ...s, name: e.target.value }))}
                            placeholder="Ej: Forro azul"
                            className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-stone-600 mb-1">
                            Código <span className="text-stone-400">(opcional, se genera)</span>
                          </label>
                          <input
                            type="text"
                            value={newTemplate.code}
                            onChange={(e) => setNewTemplate(s => ({ ...s, code: e.target.value }))}
                            placeholder={newTemplate.name ? slugify(newTemplate.name) : 'forro_azul'}
                            className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded focus:ring-1 focus:ring-amber-500 font-mono"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-stone-600">
                        <input
                          type="checkbox"
                          checked={newTemplate.is_variable}
                          onChange={(e) => setNewTemplate(s => ({ ...s, is_variable: e.target.checked }))}
                        />
                        Componente variable (cambia por talla/lote)
                      </label>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setCreating(false); setNewTemplate({ name: '', code: '', is_variable: false }); }}
                          className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleCreate}
                          disabled={saving || !newTemplate.name.trim()}
                          className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1"
                        >
                          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Crear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCreating(true)}
                      className="w-full py-2 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded-lg flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Agregar componente
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg text-sm">
            Cerrar
          </button>
        </div>
      </div>

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5">
            <h4 className="text-base font-semibold text-stone-900 mb-2">
              ¿Eliminar componente?
            </h4>
            <p className="text-sm text-stone-600 mb-4">
              <span className="font-medium">"{pendingDelete.name}"</span> quedará
              desactivado. Los valores existentes en productos se conservan pero
              dejan de sumar al costo. Podés reactivarlo cuando quieras.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingDelete(null)}
                disabled={saving}
                className="px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface TemplateRowProps {
  template: CostComponentTemplate;
  editing: EditState | null;
  setEditing: (s: EditState) => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  canEdit: boolean;
  saving: boolean;
  muted?: boolean;
}

const TemplateRow: React.FC<TemplateRowProps> = ({
  template, editing, setEditing, onEdit, onCancelEdit, onSaveEdit,
  onToggleActive, onDelete, canEdit, saving, muted,
}) => {
  const isEditing = !!editing;
  return (
    <div className={`border rounded-lg p-3 flex items-center gap-3 ${muted ? 'border-stone-200 bg-stone-50 opacity-60' : 'border-stone-200 bg-white'}`}>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={editing!.name}
                onChange={(e) => setEditing({ ...editing!, name: e.target.value })}
                className="flex-1 px-2 py-1 text-sm border border-stone-200 rounded focus:ring-1 focus:ring-amber-500"
              />
              <input
                type="number"
                value={editing!.display_order}
                onChange={(e) => setEditing({ ...editing!, display_order: Number(e.target.value) || 0 })}
                className="w-16 px-2 py-1 text-sm border border-stone-200 rounded text-center"
                title="Orden de despliegue"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={editing!.is_variable}
                onChange={(e) => setEditing({ ...editing!, is_variable: e.target.checked })}
              />
              Variable
            </label>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium text-stone-900">{template.name}</span>
            {template.is_variable && (
              <span className="text-[10px] uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Variable</span>
            )}
            <code className="text-[11px] text-stone-400 font-mono">{template.code}</code>
            <span className="text-[11px] text-stone-400">orden {template.display_order}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isEditing ? (
          <>
            <button
              onClick={onSaveEdit}
              disabled={saving}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
              title="Guardar"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={onCancelEdit} className="p-1.5 text-stone-500 hover:bg-stone-100 rounded" title="Cancelar">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : canEdit ? (
          <>
            <button
              onClick={onToggleActive}
              disabled={saving}
              className={`px-2 py-1 text-xs rounded ${template.is_active ? 'text-amber-700 hover:bg-amber-50' : 'text-green-700 hover:bg-green-50'}`}
              title={template.is_active ? 'Desactivar (preserva data)' : 'Reactivar'}
            >
              {template.is_active ? 'Desactivar' : 'Reactivar'}
            </button>
            <button
              onClick={onEdit}
              disabled={saving}
              className="px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 rounded"
            >
              Editar
            </button>
            {template.is_active && (
              <button
                onClick={onDelete}
                disabled={saving}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                title="Eliminar (soft)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default TemplateManagerModal;
