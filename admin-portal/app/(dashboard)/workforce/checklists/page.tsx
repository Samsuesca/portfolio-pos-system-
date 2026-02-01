'use client';

import { useState, useEffect } from 'react';
import { Pencil, Trash2, User, Users } from 'lucide-react';
import { RequirePermission } from '@/components/RequirePermission';
import workforceService, {
  ChecklistTemplate,
  ChecklistTemplateItem,
  DailyChecklist,
  ChecklistTemplateCreate,
  AssignmentType,
  ASSIGNMENT_TYPE_LABELS,
  ASSIGNMENT_TYPE_COLORS,
} from '@/lib/services/workforceService';
import employeeService, { EmployeeListItem } from '@/lib/services/employeeService';

export default function ChecklistsPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [dailyChecklists, setDailyChecklists] = useState<DailyChecklist[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'templates'>('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Template form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ChecklistTemplateCreate>({
    name: '',
    assignment_type: 'position',
    position: '',
    employee_id: undefined,
    items: [],
  });
  const [newItemDesc, setNewItemDesc] = useState('');

  // Edit template
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    assignment_type: 'position' as AssignmentType,
    position: '',
    employee_id: undefined as string | undefined,
    is_active: true,
  });
  const [newTemplateItemDesc, setNewTemplateItemDesc] = useState<Record<string, string>>({});

  // Get unique positions from employees
  const positions = Array.from(new Set(employees.map((e) => e.position).filter(Boolean)));

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [tmpl, daily, emps] = await Promise.all([
        workforceService.getChecklistTemplates(),
        workforceService.getDailyChecklists({ checklist_date: selectedDate }),
        employeeService.list({ is_active: true }),
      ]);
      setTemplates(tmpl);
      setDailyChecklists(daily);
      setEmployees(emps);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const handleGenerate = async () => {
    try {
      await workforceService.generateDailyChecklists(selectedDate);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al generar checklists');
    }
  };

  const handleToggleItem = async (itemId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      await workforceService.updateChecklistItemStatus(itemId, { status: newStatus });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al actualizar item');
    }
  };

  const handleVerify = async (checklistId: string) => {
    try {
      await workforceService.verifyChecklist(checklistId);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al verificar checklist');
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const payload: ChecklistTemplateCreate = {
        name: formData.name,
        assignment_type: formData.assignment_type,
        items: formData.items,
      };
      if (formData.assignment_type === 'position') {
        payload.position = formData.position;
      } else {
        payload.employee_id = formData.employee_id;
      }
      await workforceService.createChecklistTemplate(payload);
      setShowForm(false);
      setFormData({ name: '', assignment_type: 'position', position: '', employee_id: undefined, items: [] });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al crear plantilla');
    }
  };

  const addFormItem = () => {
    if (!newItemDesc.trim()) return;
    setFormData({
      ...formData,
      items: [...(formData.items || []), { description: newItemDesc.trim(), sort_order: (formData.items || []).length, is_required: true }],
    });
    setNewItemDesc('');
  };

  const handleStartEdit = (template: ChecklistTemplate) => {
    setEditingTemplate(template);
    setEditFormData({
      name: template.name,
      assignment_type: template.assignment_type,
      position: template.position || '',
      employee_id: template.employee_id || undefined,
      is_active: template.is_active,
    });
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const payload: any = {
        name: editFormData.name,
        assignment_type: editFormData.assignment_type,
        is_active: editFormData.is_active,
      };
      if (editFormData.assignment_type === 'position') {
        payload.position = editFormData.position;
        payload.employee_id = null;
      } else {
        payload.employee_id = editFormData.employee_id;
        payload.position = null;
      }
      await workforceService.updateChecklistTemplate(editingTemplate.id, payload);
      setEditingTemplate(null);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al actualizar plantilla');
    }
  };

  const handleDeleteTemplateItem = async (itemId: string) => {
    if (!window.confirm('Eliminar esta tarea?')) return;
    try {
      await workforceService.deleteChecklistTemplateItem(itemId);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al eliminar tarea');
    }
  };

  const handleAddTemplateItem = async (templateId: string) => {
    const desc = newTemplateItemDesc[templateId]?.trim();
    if (!desc) return;
    try {
      await workforceService.addChecklistTemplateItem(templateId, {
        description: desc,
        is_required: true,
      });
      setNewTemplateItemDesc({ ...newTemplateItemDesc, [templateId]: '' });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Error al agregar tarea');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Checklists</h1>
          <p className="text-slate-500">Checklists diarios por cargo o empleado individual.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'daily' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-500'
          }`}
        >
          Checklists del Dia
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
            activeTab === 'templates' ? 'border-purple-500 text-purple-600' : 'border-transparent text-slate-500'
          }`}
        >
          Plantillas
        </button>
      </div>

      {/* Daily Checklists */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          <RequirePermission permission="workforce.manage_checklists">
            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
              >
                Generar Checklists del Dia
              </button>
            </div>
          </RequirePermission>

          {loading ? (
            <div className="text-center text-slate-500 py-8">Cargando...</div>
          ) : dailyChecklists.length === 0 ? (
            <div className="text-center text-slate-500 py-8 bg-white rounded-lg border border-slate-200">
              No hay checklists para esta fecha. Presiona "Generar" para crear los del dia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyChecklists.map((cl) => (
                <div key={cl.id} className="bg-white rounded-lg border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{cl.employee_name}</h3>
                      <div className="text-sm text-slate-500">
                        {cl.completed_items}/{cl.total_items} tareas ({Number(cl.completion_rate).toFixed(0)}%)
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cl.verified_at ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          Verificado
                        </span>
                      ) : (
                        <RequirePermission permission="workforce.manage_checklists">
                          <button
                            onClick={() => handleVerify(cl.id)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200"
                          >
                            Verificar
                          </button>
                        </RequirePermission>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all"
                      style={{ width: `${Number(cl.completion_rate)}%` }}
                    />
                  </div>

                  {/* Items */}
                  <div className="space-y-1">
                    {cl.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 py-1 cursor-pointer"
                        onClick={() => handleToggleItem(item.id, item.status)}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          item.status === 'completed'
                            ? 'bg-purple-500 border-purple-500 text-white'
                            : item.status === 'skipped'
                            ? 'bg-slate-300 border-slate-300 text-white'
                            : 'border-slate-300'
                        }`}>
                          {item.status === 'completed' && '✓'}
                          {item.status === 'skipped' && '—'}
                        </div>
                        <span className={`text-sm ${item.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {item.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <RequirePermission permission="workforce.manage_checklists">
            <div className="flex justify-end">
              <button
                onClick={() => setShowForm(!showForm)}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
              >
                + Nueva Plantilla
              </button>
            </div>

            {showForm && (
              <div className="bg-white p-6 rounded-lg border border-slate-200 space-y-4">
                <h3 className="font-semibold">Nueva Plantilla de Checklist</h3>

                {/* Assignment Type Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo de Asignacion</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="assignment_type"
                        value="position"
                        checked={formData.assignment_type === 'position'}
                        onChange={() => setFormData({ ...formData, assignment_type: 'position', employee_id: undefined })}
                        className="text-purple-500 focus:ring-purple-500"
                      />
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Por Cargo (todos los empleados)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="assignment_type"
                        value="employee"
                        checked={formData.assignment_type === 'employee'}
                        onChange={() => setFormData({ ...formData, assignment_type: 'employee', position: '' })}
                        className="text-purple-500 focus:ring-purple-500"
                      />
                      <User className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">Individual (empleado especifico)</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Nombre (ej: Tareas Apertura)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />

                  {formData.assignment_type === 'position' ? (
                    <select
                      value={formData.position || ''}
                      onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Seleccionar cargo...</option>
                      {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={formData.employee_id || ''}
                      onChange={(e) => setFormData({ ...formData, employee_id: e.target.value || undefined })}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Seleccionar empleado...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name} - {emp.position}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tareas:</label>
                  {(formData.items || []).map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                      <span className="text-slate-400">{i + 1}.</span>
                      <span>{item.description}</span>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Descripcion de la tarea"
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addFormItem()}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                    <button onClick={addFormItem} className="px-3 py-2 bg-slate-200 rounded-lg text-sm">Agregar</button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleCreateTemplate} className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm">Guardar</button>
                  <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm">Cancelar</button>
                </div>
              </div>
            )}
          </RequirePermission>

          {templates.map((t) => (
            <div key={t.id} className="bg-white p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">{t.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${ASSIGNMENT_TYPE_COLORS[t.assignment_type]}`}>
                    {t.assignment_type === 'employee' ? <User className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {ASSIGNMENT_TYPE_LABELS[t.assignment_type]}
                  </span>
                  <RequirePermission permission="workforce.manage_checklists">
                    <button
                      onClick={() => handleStartEdit(t)}
                      className="text-slate-400 hover:text-purple-600"
                      title="Editar plantilla"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </RequirePermission>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">
                    {t.assignment_type === 'employee'
                      ? `Empleado: ${t.employee_name || 'Sin asignar'}`
                      : `Cargo: ${t.position || 'Sin asignar'}`
                    } | {t.items.length} tareas
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                    {t.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
              </div>
              <ul className="space-y-1">
                {t.items.map((item, i) => (
                  <li key={item.id} className="group text-sm text-slate-600 flex items-center gap-2">
                    <span className="text-slate-400">{i + 1}.</span>
                    <span className="flex-1">{item.description}</span>
                    {item.is_required && <span className="text-red-400 text-xs">*</span>}
                    <RequirePermission permission="workforce.manage_checklists">
                      <button
                        onClick={() => handleDeleteTemplateItem(item.id)}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar tarea"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </RequirePermission>
                  </li>
                ))}
              </ul>
              <RequirePermission permission="workforce.manage_checklists">
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                  <input
                    type="text"
                    placeholder="Nueva tarea..."
                    value={newTemplateItemDesc[t.id] || ''}
                    onChange={(e) => setNewTemplateItemDesc({ ...newTemplateItemDesc, [t.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTemplateItem(t.id)}
                    className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
                  />
                  <button
                    onClick={() => handleAddTemplateItem(t.id)}
                    className="px-3 py-1.5 bg-slate-200 rounded-lg text-sm hover:bg-slate-300"
                  >
                    Agregar
                  </button>
                </div>
              </RequirePermission>
            </div>
          ))}
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Editar Plantilla</h3>
            <RequirePermission permission="workforce.manage_checklists">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Nombre</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>

                {/* Assignment Type */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Tipo de Asignacion</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="edit_assignment_type"
                        value="position"
                        checked={editFormData.assignment_type === 'position'}
                        onChange={() => setEditFormData({ ...editFormData, assignment_type: 'position', employee_id: undefined })}
                        className="text-purple-500 focus:ring-purple-500"
                      />
                      <Users className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Por Cargo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="edit_assignment_type"
                        value="employee"
                        checked={editFormData.assignment_type === 'employee'}
                        onChange={() => setEditFormData({ ...editFormData, assignment_type: 'employee', position: '' })}
                        className="text-purple-500 focus:ring-purple-500"
                      />
                      <User className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">Individual</span>
                    </label>
                  </div>
                </div>

                {editFormData.assignment_type === 'position' ? (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Cargo</label>
                    <select
                      value={editFormData.position}
                      onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Seleccionar cargo...</option>
                      {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-slate-700">Empleado</label>
                    <select
                      value={editFormData.employee_id || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value || undefined })}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      <option value="">Seleccionar empleado...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>{emp.full_name} - {emp.position}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit-is-active"
                    checked={editFormData.is_active}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                    className="rounded border-slate-300 text-purple-500 focus:ring-purple-500"
                  />
                  <label htmlFor="edit-is-active" className="text-sm text-slate-700">Activa</label>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdateTemplate}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </RequirePermission>
          </div>
        </div>
      )}
    </div>
  );
}
