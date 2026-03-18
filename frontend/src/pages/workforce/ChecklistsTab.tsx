import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Check, X, Calendar, ClipboardList, AlertCircle } from 'lucide-react';
import { RequirePermission } from '../../components/RequirePermission';
import workforceService, {
  ChecklistTemplate,
  ChecklistTemplateCreate,
  DailyChecklist,
  DailyChecklistItem,
  ChecklistItemStatus,
} from '../../services/workforceService';
import { EmployeeListItem } from '../../services/employeeService';
import { extractErrorMessage } from '../../utils/api-client';
import { getScoreColor, getScoreBg, todayStr } from './helpers';

export default function ChecklistsTab({ employees: _employees }: { employees: EmployeeListItem[] }) {
  const [subTab, setSubTab] = useState<'daily' | 'templates'>('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // --- Daily checklists state ---
  const [dailyChecklists, setDailyChecklists] = useState<DailyChecklist[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // --- Templates state ---
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState<ChecklistTemplateCreate>({
    name: '',
    position: '',
    description: '',
    items: [],
  });
  const [newItemText, setNewItemText] = useState('');
  const [templateError, setTemplateError] = useState('');

  // --- Edit template modal state ---
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState({ name: '', position: '', is_active: true });

  // --- Inline add item per template ---
  const [addingItemToTemplate, setAddingItemToTemplate] = useState<string | null>(null);
  const [inlineItemText, setInlineItemText] = useState('');

  const loadDailyChecklists = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const data = await workforceService.getDailyChecklists({ checklist_date: selectedDate });
      setDailyChecklists(data);
    } catch (err) {
      console.error('Error loading daily checklists:', err);
    } finally {
      setLoadingDaily(false);
    }
  }, [selectedDate]);

  const loadChecklistTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const data = await workforceService.getChecklistTemplates();
      setChecklistTemplates(data);
    } catch (err) {
      console.error('Error loading checklist templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    if (subTab === 'daily') {
      loadDailyChecklists();
    } else {
      loadChecklistTemplates();
    }
  }, [subTab, loadDailyChecklists, loadChecklistTemplates]);

  const handleGenerateDaily = async () => {
    try {
      await workforceService.generateDailyChecklists(selectedDate);
      loadDailyChecklists();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleToggleItem = async (item: DailyChecklistItem) => {
    const newStatus: ChecklistItemStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await workforceService.updateChecklistItemStatus(item.id, { status: newStatus });
      loadDailyChecklists();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleVerifyChecklist = async (checklistId: string) => {
    try {
      await workforceService.verifyChecklist(checklistId);
      loadDailyChecklists();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', position: '', description: '', items: [] });
    setNewItemText('');
    setShowTemplateForm(false);
    setTemplateError('');
  };

  const handleAddFormItem = () => {
    if (!newItemText.trim()) return;
    setTemplateForm((p) => ({
      ...p,
      items: [
        ...(p.items || []),
        {
          description: newItemText.trim(),
          sort_order: (p.items || []).length + 1,
          is_required: true,
        },
      ],
    }));
    setNewItemText('');
  };

  const handleRemoveFormItem = (idx: number) => {
    setTemplateForm((p) => ({
      ...p,
      items: (p.items || []).filter((_, i) => i !== idx),
    }));
  };

  const handleCreateTemplate = async () => {
    setTemplateError('');
    if (!templateForm.name.trim()) {
      setTemplateError('El nombre es obligatorio.');
      return;
    }
    if (!templateForm.position?.trim()) {
      setTemplateError('El cargo es obligatorio.');
      return;
    }
    try {
      await workforceService.createChecklistTemplate({
        name: templateForm.name,
        position: templateForm.position,
        description: templateForm.description || undefined,
        items: templateForm.items,
      });
      resetTemplateForm();
      loadChecklistTemplates();
    } catch (err) {
      setTemplateError(extractErrorMessage(err));
    }
  };

  const handleEditTemplateOpen = (t: ChecklistTemplate) => {
    setEditingTemplate(t);
    setEditTemplateForm({ name: t.name, position: t.position || '', is_active: t.is_active });
  };

  const handleEditTemplateSave = async () => {
    if (!editingTemplate) return;
    try {
      await workforceService.updateChecklistTemplate(editingTemplate.id, {
        name: editTemplateForm.name,
        position: editTemplateForm.position,
        is_active: editTemplateForm.is_active,
      });
      setEditingTemplate(null);
      loadChecklistTemplates();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleDeleteTemplateItem = async (itemId: string) => {
    if (!window.confirm('Eliminar este item?')) return;
    try {
      await workforceService.deleteChecklistTemplateItem(itemId);
      loadChecklistTemplates();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  const handleAddInlineItem = async (templateId: string) => {
    if (!inlineItemText.trim()) return;
    try {
      await workforceService.addChecklistTemplateItem(templateId, {
        description: inlineItemText.trim(),
      });
      setInlineItemText('');
      setAddingItemToTemplate(null);
      loadChecklistTemplates();
    } catch (err) {
      alert(extractErrorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'daily'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('daily')}
        >
          Checklists del Dia
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            subTab === 'templates'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setSubTab('templates')}
        >
          Plantillas
        </button>
      </div>

      {/* Daily checklists sub-tab */}
      {subTab === 'daily' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar size={18} className="text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
              />
            </div>
            <RequirePermission permission="workforce.manage_checklists">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={handleGenerateDaily}
              >
                <ClipboardList size={16} /> Generar Checklists del Dia
              </button>
            </RequirePermission>
          </div>

          {loadingDaily ? (
            <div className="text-center py-8 text-gray-500">Cargando checklists...</div>
          ) : dailyChecklists.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay checklists para esta fecha. Genera los checklists del dia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dailyChecklists.map((cl) => {
                const rate = cl.total_items > 0 ? Math.round((cl.completed_items / cl.total_items) * 100) : 0;
                return (
                  <div
                    key={cl.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">{cl.employee_name || 'Empleado'}</h4>
                      <span className={`text-sm font-medium ${getScoreColor(rate)}`}>
                        {rate}%
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getScoreBg(rate)}`}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {cl.completed_items} de {cl.total_items} items completados
                    </p>
                    {/* Items */}
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {cl.items.map((item) => (
                        <RequirePermission
                          key={item.id}
                          permissions={['workforce.manage_checklists', 'workforce.self_checklist']}
                          fallback={
                            <div className="flex items-center gap-2 py-1">
                              <span
                                className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                                  item.status === 'completed'
                                    ? 'bg-green-500 border-green-500 text-white'
                                    : 'border-gray-300'
                                }`}
                              >
                                {item.status === 'completed' && <Check size={10} />}
                              </span>
                              <span
                                className={`text-sm ${
                                  item.status === 'completed'
                                    ? 'text-gray-400 line-through'
                                    : 'text-gray-700'
                                }`}
                              >
                                {item.description}
                              </span>
                            </div>
                          }
                        >
                          <button
                            className="flex items-center gap-2 py-1 w-full text-left hover:bg-gray-50 rounded px-1"
                            onClick={() => handleToggleItem(item)}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center text-xs flex-shrink-0 ${
                                item.status === 'completed'
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300'
                              }`}
                            >
                              {item.status === 'completed' && <Check size={10} />}
                            </span>
                            <span
                              className={`text-sm ${
                                item.status === 'completed'
                                  ? 'text-gray-400 line-through'
                                  : 'text-gray-700'
                              }`}
                            >
                              {item.description}
                            </span>
                          </button>
                        </RequirePermission>
                      ))}
                    </div>
                    {/* Verify button */}
                    {!cl.verified_by ? (
                      <RequirePermission permission="workforce.manage_checklists">
                        <button
                          className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                          onClick={() => handleVerifyChecklist(cl.id)}
                        >
                          Verificar
                        </button>
                      </RequirePermission>
                    ) : (
                      <p className="text-xs text-green-600 font-medium text-center">
                        Verificado
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Templates sub-tab */}
      {subTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Plantillas de Checklist</h3>
            <RequirePermission permission="workforce.manage_checklists">
              <button
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                onClick={() => {
                  resetTemplateForm();
                  setShowTemplateForm(true);
                }}
              >
                <Plus size={16} /> Nueva Plantilla
              </button>
            </RequirePermission>
          </div>

          {/* Create template form */}
          {showTemplateForm && (
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <h4 className="font-semibold text-gray-900">Nueva Plantilla de Checklist</h4>
              {templateError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle size={16} /> {templateError}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Checklist apertura"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <input
                    type="text"
                    value={templateForm.position}
                    onChange={(e) => setTemplateForm((p) => ({ ...p, position: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Vendedor"
                  />
                </div>
              </div>
              {/* Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Items</label>
                {(templateForm.items || []).length > 0 && (
                  <ul className="space-y-1 mb-2">
                    {(templateForm.items || []).map((item, idx) => (
                      <li
                        key={idx}
                        className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm"
                      >
                        <span className="text-gray-700">{item.description}</span>
                        <button
                          className="text-gray-400 hover:text-red-600"
                          onClick={() => handleRemoveFormItem(idx)}
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddFormItem()}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    placeholder="Agregar item..."
                  />
                  <button
                    className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                    onClick={handleAddFormItem}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                  onClick={handleCreateTemplate}
                >
                  Crear
                </button>
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                  onClick={resetTemplateForm}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Edit template modal */}
          {editingTemplate && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Editar Plantilla</h3>
                  <button
                    className="p-1 text-gray-400 hover:text-gray-600"
                    onClick={() => setEditingTemplate(null)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={editTemplateForm.name}
                      onChange={(e) =>
                        setEditTemplateForm((p) => ({ ...p, name: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                    <input
                      type="text"
                      value={editTemplateForm.position}
                      onChange={(e) =>
                        setEditTemplateForm((p) => ({ ...p, position: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-template-active"
                      checked={editTemplateForm.is_active}
                      onChange={(e) =>
                        setEditTemplateForm((p) => ({ ...p, is_active: e.target.checked }))
                      }
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="edit-template-active" className="text-sm text-gray-700">
                      Activo
                    </label>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                    onClick={() => setEditingTemplate(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium"
                    onClick={handleEditTemplateSave}
                  >
                    Actualizar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Template cards */}
          {loadingTemplates ? (
            <div className="text-center py-8 text-gray-500">Cargando plantillas...</div>
          ) : checklistTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No hay plantillas de checklist.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {checklistTemplates.map((t) => (
                <div
                  key={t.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                        {t.name}
                        <RequirePermission permission="workforce.manage_checklists">
                          <button
                            className="p-1 text-gray-400 hover:text-brand-600"
                            onClick={() => handleEditTemplateOpen(t)}
                            title="Editar plantilla"
                          >
                            <Pencil size={13} />
                          </button>
                        </RequirePermission>
                      </h4>
                      <p className="text-xs text-gray-500">{t.position}</p>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        t.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {t.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between group text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded"
                      >
                        <span>{item.description}</span>
                        <RequirePermission permission="workforce.manage_checklists">
                          <button
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600 transition-opacity"
                            onClick={() => handleDeleteTemplateItem(item.id)}
                            title="Eliminar item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </RequirePermission>
                      </li>
                    ))}
                  </ul>
                  {/* Inline add item */}
                  <RequirePermission permission="workforce.manage_checklists">
                    {addingItemToTemplate === t.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inlineItemText}
                          onChange={(e) => setInlineItemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddInlineItem(t.id);
                            if (e.key === 'Escape') {
                              setAddingItemToTemplate(null);
                              setInlineItemText('');
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                          placeholder="Nuevo item..."
                          autoFocus
                        />
                        <button
                          className="p-1 text-green-600 hover:text-green-700"
                          onClick={() => handleAddInlineItem(t.id)}
                        >
                          <Check size={16} />
                        </button>
                        <button
                          className="p-1 text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setAddingItemToTemplate(null);
                            setInlineItemText('');
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="text-sm text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                        onClick={() => {
                          setAddingItemToTemplate(t.id);
                          setInlineItemText('');
                        }}
                      >
                        <Plus size={14} /> Agregar item
                      </button>
                    )}
                  </RequirePermission>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
